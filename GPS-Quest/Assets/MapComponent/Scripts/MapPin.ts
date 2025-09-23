import {CancelFunction} from "SpectaclesInteractionKit.lspkg/Utils/animate"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Place} from "SpectaclesNavigationKit.lspkg/NavigationDataComponent/Place"
import {easeOutElastic, makeTween} from "./MapUtils"

let pinAvailableID = 0
const HIGHLIGHT_TWEEN_DURATION = 1
const LABEL_BOUNDARY_PADDING = 4
const LABEL_CIRCLE_BOUNDARY_PADDING = 4

/**
 * GPS Quest v1.0 - Map Pin Visualization
 *
 * Represents a visual pin on the minimap that marks a GPS waypoint.
 * Handles visual state changes including selection, hovering, and visited status.
 *
 * Key Features:
 * - Dynamic color change when waypoint is visited (green = visited)
 * - Material cloning for visited state visualization
 * - Hover and selection visual feedback
 * - Label display with boundary checking
 * - Minimap/fullmap toggle support
 *
 * Modified by: Pavlo Tkachenko
 * Date: September 2024
 * Changes: Added visited state visualization with green color
 */
export class MapPin {
  private readonly highlightedColor: vec4
  private readonly selectedColor: vec4
  private isUser: boolean
  private _selected: boolean = false
  private _isVisited: boolean = false
  private _isNextActive: boolean = false
  private originalMaterial: Material = null
  private visitedMaterial: Material = null
  private hiddenScale: vec3 = vec3.zero()
  private normalScale: vec3 = vec3.one()
  sceneObject: SceneObject
  screenTransform: ScreenTransform
  place: Place
  imageComponent: Image
  outlineImageComponent: Image = undefined
  outlineTransform: Transform = undefined
  selectedImageComponent: Image = undefined
  selectedTransform: Transform = undefined
  label: Text = undefined
  tweenCancelFunction: CancelFunction
  canBeMoved: boolean

  private selectedEvent = new Event<void>()
  public onSelected = this.selectedEvent.publicApi()

  private visitedEvent = new Event<void>()
  public onVisited = this.visitedEvent.publicApi()

  public get selected(): boolean {
    return this._selected
  }

  public set selected(value: boolean) {
    this.selectedTransform.getSceneObject().enabled = value
    this._selected = value
    this.selectedEvent.invoke()
  }

  static makeMapPin(
    prefab: ObjectPrefab,
    parent: SceneObject,
    place: Place | null,
    renderConfig: MapPinRenderConfig,
    isUser = false,
  ): MapPin {
    const pin = new MapPin()
    pin.isUser = isUser
    pin.sceneObject = prefab.instantiate(parent)
    pin.screenTransform = pin.sceneObject.getComponent("Component.ScreenTransform")
    pin.place = place

    // Store the original scale for animations
    pin.normalScale = new vec3(
      pin.screenTransform.scale.x,
      pin.screenTransform.scale.y,
      pin.screenTransform.scale.z
    )

    pin.canBeMoved = place.requestNewGeoPosition(place.getGeoPosition())

    //Sets right render layers to all the objects in the map pin hierarchy
    pin.sceneObject.layer = renderConfig.layer
    pin.imageComponent = pin.sceneObject.getComponent("Component.Image")
    if (pin.imageComponent) {
      pin.imageComponent.setRenderOrder(renderConfig.renderOrder + 3)
    }

    if (pin.sceneObject.getChildrenCount() > 0) {
      const outlineObject = pin.sceneObject.getChild(0)
      pin.outlineTransform = outlineObject.getTransform()
      pin.outlineImageComponent = outlineObject.getComponent("Component.Image")
    }

    if (pin.sceneObject.getChildrenCount() > 1) {
      const selectedObject = pin.sceneObject.getChild(1)
      pin.selectedTransform = selectedObject.getTransform()
      pin.selectedImageComponent = selectedObject.getComponent("Component.Image")
    }

    for (let i = 0; i < pin.sceneObject.getChildrenCount(); i++) {
      const child = pin.sceneObject.getChild(i)
      child.layer = renderConfig.layer
      const imageComponent = child.getComponent("Image")
      if (imageComponent) {
        imageComponent.setRenderOrder(renderConfig.renderOrder + 2)
      }
    }

    if (pin.sceneObject.getChildrenCount() > 2) {
      pin.label = pin.sceneObject.getChild(2).getComponent("Component.Text")
      pin.label.setRenderOrder(renderConfig.renderOrder + 2)
    }

    return pin
  }

  updateRenderBound(topLeftCorner: vec3, topLeftToBottomLeft: vec3, topLeftToTopRight: vec3): void {
    this.setImageSize(this.imageComponent, topLeftCorner, topLeftToBottomLeft, topLeftToTopRight)
    this.setImageSize(this.outlineImageComponent, topLeftCorner, topLeftToBottomLeft, topLeftToTopRight)
    this.setImageSize(this.selectedImageComponent, topLeftCorner, topLeftToBottomLeft, topLeftToTopRight)
    if (this.label !== undefined) {
      const worldPosition = this.screenTransform.getTransform().getWorldPosition()
      const leftPadding = topLeftToTopRight.normalize().uniformScale(LABEL_BOUNDARY_PADDING)
      const topPadding = topLeftToBottomLeft.normalize().uniformScale(LABEL_BOUNDARY_PADDING)
      const fromCorner = worldPosition.sub(topLeftCorner.add(leftPadding).add(topPadding))
      const paddedVertical = topLeftToBottomLeft.sub(topPadding)
      const paddedHorizontal = topLeftToTopRight.sub(leftPadding.uniformScale(2))
      const dotVerticalVector = paddedVertical.dot(paddedVertical)
      const dotVerticalFromCorner = fromCorner.dot(paddedVertical)
      const dotHorizontalFromCorner = fromCorner.dot(paddedHorizontal)
      const dotHorizontalVector = paddedHorizontal.dot(paddedHorizontal)
      if (
        Math.min(
          dotVerticalVector > dotVerticalFromCorner ? 1 : 0,
          dotVerticalFromCorner,
          dotHorizontalVector > dotHorizontalFromCorner ? 1 : 0,
          dotHorizontalFromCorner,
        ) <= 0
      ) {
        this.label.backgroundSettings.enabled = false
        this.label.sceneObject.enabled = false
      } else {
        this.label.backgroundSettings.enabled = true
        this.label.sceneObject.enabled = true
      }
    }
  }

  updateCircularRenderBound(center: vec3): void {
    const veryOutOfCircle = this.screenTransform.position.length > 9
    if (this.imageComponent && this.imageComponent.mainMaterial && this.imageComponent.mainMaterial.mainPass) {
      this.imageComponent.mainMaterial.mainPass.circleBoundCentre = center
    }
    if (this.outlineImageComponent !== undefined) {
      this.outlineImageComponent.enabled = veryOutOfCircle || this.isUser
      if (this.outlineImageComponent.mainMaterial && this.outlineImageComponent.mainMaterial.mainPass) {
        this.outlineImageComponent.mainMaterial.mainPass.circleBoundCentre = center
      }
    }
    if (this.selectedImageComponent !== undefined) {
      this.selectedImageComponent.enabled = !veryOutOfCircle
      if (this.selectedImageComponent.mainMaterial && this.selectedImageComponent.mainMaterial.mainPass) {
        this.selectedImageComponent.mainMaterial.mainPass.circleBoundCentre = center
      }
    }
    if (this.label !== undefined) {
      const outOfCircle =
        this.screenTransform.position.add(this.label.getTransform().getLocalPosition()).length >
        LABEL_CIRCLE_BOUNDARY_PADDING
      this.label.sceneObject.enabled = !veryOutOfCircle
      this.label.backgroundSettings.enabled = !outOfCircle
    }
  }

  setName(name: string): void {
    this.sceneObject.name = name
    if (this.label !== undefined) {
      this.label.text = name
    }
  }

  toggleMiniMap(isMiniMap: boolean): void {
    if (this.imageComponent && this.imageComponent.mainMaterial && this.imageComponent.mainMaterial.mainPass) {
      this.imageComponent.mainMaterial.mainPass.isMini = isMiniMap
    }
    if (!isNull(this.outlineImageComponent) && this.outlineImageComponent.mainMaterial && this.outlineImageComponent.mainMaterial.mainPass) {
      this.outlineImageComponent.mainMaterial.mainPass.isMini = isMiniMap
    }
  }

  enableOutline(enabled: boolean): void {
    if (this.outlineTransform === undefined) {
      return
    }
    this.outlineTransform.getSceneObject().enabled = enabled
  }

  highlight(): void {
    if (this.outlineTransform === undefined) {
      return
    }
    if (this.tweenCancelFunction !== undefined) {
      this.tweenCancelFunction()
      this.tweenCancelFunction = undefined
    }

    this.enableOutline(true)

    this.tweenCancelFunction = makeTween((t) => {
      const easeOutNumber = easeOutElastic(t)
      this.outlineTransform.setLocalScale(new vec3(easeOutNumber, easeOutNumber, easeOutNumber))
      this.selectedTransform.setLocalScale(new vec3(easeOutNumber, easeOutNumber, easeOutNumber))
    }, HIGHLIGHT_TWEEN_DURATION)
  }

  setVisible(visible: boolean): void {
    this.sceneObject.enabled = visible
  }

  /**
   * Gets the visited state of this pin
   * @returns true if the waypoint has been visited by the user
   */
  public get isVisited(): boolean {
    return this._isVisited
  }

  /**
   * Sets the visited state and updates the visual appearance.
   * When visited, clones the material and applies green color.
   *
   * @param visited - true to mark as visited (green), false to reset
   * @fires visitedEvent when state changes to visited
   */
  public setVisited(visited: boolean): void {
    if (this._isVisited === visited) {
      return // No change needed
    }

    this._isVisited = visited

    if (visited) {
      this.applyVisitedAppearance()
      this.visitedEvent.invoke()
    } else {
      this.resetToOriginalAppearance()
    }
  }

  /**
   * Applies green color to indicate the pin has been visited.
   * Creates a cloned material with green base color (0.0, 0.8, 0.0).
   * Also updates outline color to lighter green for better visibility.
   *
   * @private
   */
  private applyVisitedAppearance(): void {
    if (!this.imageComponent || !this.imageComponent.mainMaterial) {
      return
    }

    // Store original material if not already stored
    if (!this.originalMaterial) {
      this.originalMaterial = this.imageComponent.mainMaterial
    }

    // Create visited material if not already created
    if (!this.visitedMaterial) {
      this.visitedMaterial = this.originalMaterial.clone()

      // Set green color for visited state
      if (this.visitedMaterial.mainPass) {
        // Green color with full opacity
        this.visitedMaterial.mainPass.baseColor = new vec4(0.0, 0.8, 0.0, 1.0)
      }
    }

    // Apply visited material
    this.imageComponent.mainMaterial = this.visitedMaterial

    // Also update outline if it exists
    if (this.outlineImageComponent && this.outlineImageComponent.mainMaterial) {
      const outlineMaterial = this.outlineImageComponent.mainMaterial.clone()
      if (outlineMaterial.mainPass) {
        // Lighter green for outline
        outlineMaterial.mainPass.baseColor = new vec4(0.0, 1.0, 0.0, 1.0)
      }
      this.outlineImageComponent.mainMaterial = outlineMaterial
    }
  }

  /**
   * Resets the pin appearance to original state
   */
  private resetToOriginalAppearance(): void {
    if (this.originalMaterial && this.imageComponent) {
      this.imageComponent.mainMaterial = this.originalMaterial
    }
  }

  /**
   * Updates the pin based on its place's visited state
   */
  public updateVisitedState(): void {
    if (this.place && this.place.visited !== this._isVisited) {
      this.setVisited(this.place.visited)
    }
  }

  /**
   * Sets whether this pin is the next active waypoint in the quest.
   * Active waypoints are shown, inactive are hidden (scale 0).
   *
   * @param isActive - true if this is the next waypoint to visit
   * @param animate - whether to animate the appearance
   */
  public setNextActive(isActive: boolean, animate: boolean = true): void {
    this._isNextActive = isActive

    if (animate) {
      this.animateVisibility(isActive)
    } else {
      // Immediate visibility change
      if (isActive || this._isVisited) {
        this.screenTransform.scale = this.normalScale
        this.sceneObject.enabled = true
      } else {
        this.screenTransform.scale = this.hiddenScale
        this.sceneObject.enabled = false
      }
    }
  }

  /**
   * Animates the pin appearing or disappearing
   *
   * @param show - true to show, false to hide
   * @private
   */
  private animateVisibility(show: boolean): void {
    if (show) {
      // Enable object first for animation
      this.sceneObject.enabled = true

      // Animate scale from 0 to 1 with bounce effect
      makeTween((t) => {
        const scale = easeOutElastic(t)
        this.screenTransform.scale = this.normalScale.uniformScale(scale)
      }, 0.8)
    } else if (!this._isVisited) {
      // Only hide if not visited
      makeTween((t) => {
        const scale = 1 - t
        this.screenTransform.scale = this.normalScale.uniformScale(scale)
        if (t >= 1) {
          this.sceneObject.enabled = false
        }
      }, 0.3)
    }
  }

  /**
   * Checks if this pin should be visible based on quest progression
   * @returns true if pin should be shown (visited or next active)
   */
  public shouldBeVisible(): boolean {
    return this._isVisited || this._isNextActive || this.isUser
  }

  private setImageSize(image: Image, topLeftCorner: vec3, topLeftToBottomLeft: vec3, topLeftToTopRight: vec3): void {
    if (isNull(image)) {
      return
    }

    if (image.mainMaterial && image.mainMaterial.mainPass) {
      image.mainMaterial.mainPass.cornerPosition = topLeftCorner
      image.mainMaterial.mainPass.verticalVector = topLeftToBottomLeft
      image.mainMaterial.mainPass.horizontalVector = topLeftToTopRight
    }
  }
}

export class MapPinRenderConfig {
  public readonly layer: LayerSet
  public readonly renderOrder: number
  public readonly highlightColor: vec4
  public readonly selectedColor: vec4

  constructor(layer: LayerSet, renderOrder: number, highlightColor: vec4, selectedColor: vec4) {
    this.layer = layer
    this.renderOrder = renderOrder
    this.highlightColor = highlightColor
    this.selectedColor = selectedColor
  }
}
