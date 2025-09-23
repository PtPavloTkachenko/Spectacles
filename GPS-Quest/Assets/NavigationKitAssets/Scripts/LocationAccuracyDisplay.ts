import {UserPosition, UserPositionStatus} from "SpectaclesNavigationKit.lspkg/NavigationDataComponent/UserPosition"

import { MapController } from "../../MapComponent/Scripts/MapController"
import {NavigationDataComponent} from "SpectaclesNavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent"

/**
 * GPS Quest v1.0 - GPS Accuracy Visualization
 *
 * Displays a dynamic accuracy circle around the user pin on the minimap.
 * The circle size represents GPS horizontal accuracy in meters.
 *
 * Key Features:
 * - Dynamic scaling based on GPS horizontal accuracy
 * - Minimum accuracy threshold (10 meters)
 * - Adapts to map zoom level
 * - Different pin textures for heading/no-heading states
 * - Works in both Editor and device for better development experience
 *
 * Modified by: Pavlo Tkachenko
 * Date: September 2024
 * Changes: Enabled in Editor mode for easier testing and development
 */
@component
export class LocationAccuracyDisplay extends BaseScriptComponent {
  private navigationComponent: NavigationDataComponent
  private userPosition: UserPosition
  private mapController: MapController
  private scale = 3

  @input private target: SceneObject
  @input private pinImage: Image
  @input private hadHeadingTexture: Texture
  @input private noHeadingTexture: Texture
  @input private minimumAccuracy = 10

  public initialize(navigationComponent: NavigationDataComponent, mapController: MapController): void {
    this.navigationComponent = navigationComponent
    this.mapController = mapController

    if (!this.target) {
      print("ERROR: LocationAccuracyDisplay - target SceneObject is not set!")
      return
    }

    this.target.enabled = false

    // Keep working in Editor for better development experience
    // Original code disabled accuracy in Editor, but we want it to work
    // if (global.deviceInfoSystem.isEditor()) {
    //   return
    // }

    this.userPosition = this.navigationComponent.getUserPosition()
    this.userPosition.onUserPositionUpdated.add(() => {
      this.update()
    })

    this.mapController.onMapCentered.add(() => {
      this.update()
    })
    this.target.enabled = true

    // Force initial update to show accuracy circle immediately
    this.update()
  }

  /**
   * Updates the accuracy circle visualization based on current GPS accuracy.
   * Scales the circle to represent the GPS uncertainty radius in meters.
   *
   * @private
   */
  private update(): void {
    const geoPosition = this.userPosition.getGeoPosition()
    if (isNull(geoPosition) || !this.userPosition.gpsActive) {
      return
    }

    let accuracy = geoPosition.horizontalAccuracy as number
    if (isNull(accuracy)) {
      return
    }

    // Apply minimum accuracy threshold to avoid too-small circles
    accuracy = Math.max(this.minimumAccuracy, accuracy)

    const mapZoomFactor = 1 / (6378000 * 0.5 ** this.mapController.zoomLevel)
    this.target.enabled = true
    // GPS Quest Enhancement: Double the scale for more realistic visual representation
    this.target.getTransform().setLocalScale(vec3.one().uniformScale(mapZoomFactor * accuracy * this.scale * 2))

    // Commented out to reduce log spam - uncomment for debugging
    // print(`TEST: Accuracy circle enabled=${this.target.enabled}, scale=${mapZoomFactor * accuracy * this.scale}`)

    const hasHeading = this.userPosition.status === UserPositionStatus.GeoLocalizationAvailable
    this.pinImage.mainPass.baseTex = hasHeading ? this.hadHeadingTexture : this.noHeadingTexture
  }
}
