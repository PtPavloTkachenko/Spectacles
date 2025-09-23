import {unsubscribe} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"
import {NavigationDataComponent} from "../../NavigationDataComponent/NavigationDataComponent"
import {Place} from "../../NavigationDataComponent/Place"
import {UserPosition} from "../../NavigationDataComponent/UserPosition"

/**
 * Measurement system enum for distance display
 */
enum MeasurementSystem {
  Metric = 1,
  US = 0,
}

const log = new NativeLogger("ARNavigation")

/**
 * GPS Quest v1.0 - AR Navigation Arrow
 * 
 * Controls directional arrow that points to active waypoints in outdoor GPS navigation.
 * This component has been simplified from the original Navigation Kit to focus
 * exclusively on outdoor GPS-based arrow guidance for Spectacles.
 * 
 * Cleanup Notes (336 → 265 lines):
 * - Removed distance text displays (distanceTexts input removed)
 * - Removed waypoint name text (placeNameText input removed) 
 * - Removed complex check sign animations and delays
 * - Simplified destination reached logic (immediate switch to next waypoint)
 * - Removed commented out code blocks
 * - Streamlined for continuous outdoor navigation
 * 
 * Key Features:
 * - 3D arrow pointing to active waypoint
 * - Smooth rotation animation following user orientation
 * - Automatic switching between waypoints when reached
 * - Distance-based measurement system (metric/US)
 * - Directional tip angle for better visibility
 * 
 * Usage:
 * - Automatically orients to first waypoint on start
 * - Continuously updates arrow direction based on GPS position
 * - Switches to next waypoint when current one is reached
 * - Hides arrow when all waypoints are completed
 * 
 * Original by: Snap Inc.
 * Modified by: Pavlo Tkachenko
 * Website: pavlotkachenko.com
 * 
 * @version 1.0.0 (GPS Quest - Simplified)
 */
@component
export class ARNavigation extends BaseScriptComponent {
  @input
  private navigationDataComponent: NavigationDataComponent  // Navigation system reference

  @input
  private targetPivot: SceneObject                         // Pivot object for arrow rotation

  @input
  @hint("The arrow showing the direction to the selected place.")
  private arrowRenderMeshVisual: RenderMeshVisual          // Visual arrow mesh

  @input("int")
  @widget(new ComboBoxWidget([new ComboBoxItem("Metric", 0), new ComboBoxItem("US", 1)]))
  measurementSystem: MeasurementSystem = MeasurementSystem.Metric  // Distance measurement system

  @input
  private showByDefault: boolean = false                   // Whether to show arrow by default

  @input
  @hint("When within this radius, the arrow will no longer show a direction.")
  public hereRadius: number = 3                           // Radius for "here" detection (meters)

  @input
  @hint("An angle, in degrees, by which the arrow will be tipped forward when pointing.")
  public directionalTip: number = 20                      // Arrow tip angle for visibility

  // Internal state and references
  private targetPivotTransform: Transform              // Transform for arrow pivot
  private selectedPlace: Place | null = null           // Currently selected waypoint
  private userPosition: UserPosition | null = null     // User's GPS position tracker
  private smoothArrowRotationUpdate: UpdateEvent | null = null  // Update event for smooth rotation
  private initialArrowScale: vec3                      // Original arrow scale
  private initialArrowRotation: quat                   // Original arrow rotation
  private arrowTransform: Transform                    // Arrow's transform component
  private userUpdateUnsubscribe: unsubscribe           // Unsubscribe function for user updates
  public blockActivation: boolean = false             // Flag to block arrow activation

  /**
   * Initialize AR navigation component and set up arrow system
   */
  private onAwake(): void {
    // Validate required components
    if (this.arrowRenderMeshVisual === null) {
      log.e("Arrow RenderMeshVisual not set")
      return
    }

    if (this.navigationDataComponent === null) {
      log.e("NavigationDataComponent not set")
      return
    }

    // Bind to start event
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this))

    // Set up smooth arrow rotation update system
    this.smoothArrowRotationUpdate = this.createEvent("UpdateEvent")
    this.smoothArrowRotationUpdate.bind(() => {
      this.onUserPositionUpdated()           // Update target rotation
      this.smoothArrowRotationUpdateCallback()  // Apply smooth rotation
    })
    this.smoothArrowRotationUpdate.enabled = false  // Start disabled

    // Initialize arrow as hidden
    this.arrowRenderMeshVisual.sceneObject.enabled = false

    // Clone material to avoid shared material conflicts
    this.arrowRenderMeshVisual.mainMaterial = this.arrowRenderMeshVisual.mainMaterial.clone()

    // Cache transform references and initial values
    this.arrowTransform = this.arrowRenderMeshVisual.getTransform()
    this.initialArrowRotation = this.arrowTransform.getLocalRotation()
    this.initialArrowScale = this.arrowTransform.getLocalScale()
    this.targetPivotTransform = this.targetPivot.getTransform()
  }

  /**
   * Start AR navigation and subscribe to navigation events
   */
  private onStart(): void {
    // Get user position tracker
    this.userPosition = this.navigationDataComponent.getUserPosition()

    // Subscribe to navigation events
    this.navigationDataComponent.onNavigationStarted.add(this.onPlaceSelected.bind(this))
    this.navigationDataComponent.onArrivedAtPlace.add(this.onDestinationReached.bind(this))

    // Show arrow immediately for outdoor GPS navigation
    this.setVisible(true)

    // Start with first waypoint if available
    if (this.navigationDataComponent.places.length > 0) {
      this.onPlaceSelected(this.navigationDataComponent.places[0])
    }
  }

  public setVisible(visible: boolean): void {
    if (this.blockActivation) {
      return
    }

    this.showByDefault = visible
    this.arrowRenderMeshVisual.sceneObject.enabled = visible
    this.smoothArrowRotationUpdate.enabled = visible

    this.setTextVisible(visible)
  }

  private onPlaceSelected(place: Place): void {
    this.reset()
    this.selectedPlace = place
    // Place name text removed for outdoor GPS navigation

    this.setVisible(this.selectedPlace !== null)
  }

  private targetRotation: quat = quat.quatIdentity()

  private onUserPositionUpdated(): void {
    // If selectedPlace is not yet selected, orient to the first waypoint
    let targetPlace = this.selectedPlace
    if (targetPlace === null && this.navigationDataComponent.places.length > 0) {
      targetPlace = this.navigationDataComponent.places[0]
    }
    if (targetPlace === null || this.userPosition === null) {
      return
    }

    const angle = this.userPosition.getBearingTo(targetPlace, true)
    const placePosition = targetPlace.getRelativePosition()

    if (isNull(placePosition)) {
      return
    }

    const vertical = placePosition.y - this.userPosition.getRelativeTransform().getWorldPosition().y

    const absVertical = Math.abs(vertical)

    const pointQuat = quat.angleAxis(-angle, vec3.up())
    const tipQuat = quat.angleAxis(this.directionalTip * MathUtils.DegToRad, vec3.right())

    this.targetRotation = pointQuat.multiply(tipQuat)
  }

  private smoothArrowRotationUpdateCallback(): void {
    if (!this.selectedPlace || !this.userPosition) {
      return
    }
    
    // Always point to the waypoint, no special behavior when close
    const animatedTarget = this.targetRotation
    
    // Always show text
    this.setTextVisible(true)

    const smoothedRotation = quat.slerp(
      this.targetPivotTransform.getWorldRotation(),
      animatedTarget,
      getDeltaTime() * 10,
    )
    this.targetPivotTransform.setWorldRotation(smoothedRotation)
  }

  /**
   * Called when the user has reached the destination.
   * Immediately switch to next waypoint without showing check sign.
   */
  private onDestinationReached(): void {
    print("ARNavigation: onDestinationReached called - switching to next waypoint")
    
    // Disable smooth arrow rotation update
    this.smoothArrowRotationUpdate.enabled = false


    // Remove user update callback
    if (!isNull(this.userUpdateUnsubscribe)) {
      this.userUpdateUnsubscribe()
    }

    // Find next unvisited waypoint
    const places = this.navigationDataComponent.places;
    const currentIdx = places.indexOf(this.selectedPlace);
    let nextPlace = null;
    for (let i = currentIdx + 1; i < places.length; i++) {
      if (!places[i].visited) {
        nextPlace = places[i];
        break;
      }
    }
    
    if (nextPlace) {
      // Switch to next waypoint immediately
      this.onPlaceSelected(nextPlace);
    } else {
      // If all visited - hide the arrow
      this.setVisible(false);
    }
  }



  private reset(): void {
    // Reset the arrow
    this.arrowRenderMeshVisual.sceneObject.enabled = true
    this.arrowRenderMeshVisual.mainPass.alpha = 1

    this.arrowTransform.setLocalScale(this.initialArrowScale)
    this.arrowTransform.setLocalRotation(this.initialArrowRotation)

    this.smoothArrowRotationUpdate.enabled = false
  }



  private getFormattedDistance(distance: number | null): string {
    let result = ""

    if (isNull(distance)) {
      return result
    }

    if (this.measurementSystem === MeasurementSystem.Metric) {
      if (distance < 1000) {
        result = distance.toFixed(0) + "m"
      } else {
        result = (distance / 1000).toFixed(1) + "km"
      }
    } else {
      const feetDistance = distance * 3.28084
      if (feetDistance < 1609.34) {
        result = feetDistance.toFixed(0) + "ft"
      } else {
        result = (feetDistance / 1609.34).toFixed(1) + "mi"
      }
    }

    return result
  }

  private setTextVisible(_visible: boolean): void {
    // Text visibility removed for outdoor GPS navigation
  }
}
