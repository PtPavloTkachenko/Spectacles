import {GeoLocationPlace} from "./GeoLocationPlace"
import {NavigationDataComponent} from "./NavigationDataComponent"
import {convertToNumber} from "./NavigationUtils"

/**
 * GPS Quest v1.0 - Simplified Outdoor Navigation
 * 
 * Defines GPS coordinates for outdoor waypoints in the GPS navigation quest.
 * This class has been cleaned up to remove unused UI elements and focus 
 * exclusively on outdoor GPS-based navigation for Spectacles.
 * 
 * Key Features:
 * - GPS coordinate input (latitude/longitude as strings)
 * - Distance-based activation for waypoint visits
 * - Custom prefab support for individual waypoints
 * - Simplified for outdoor-only use (indoor navigation removed)
 */
@typedef
export class GeoPlaceInput {
  @input active: boolean = true                    // Whether this waypoint is active
  @input latitude: string                          // GPS latitude as string
  @input longitude: string                         // GPS longitude as string  
  @input label: string                             // Display name for the waypoint
  @input
  @hint("The distance, in meters, calculated from geo positions, that the user must be to visit the place.")
  distanceToActivate: number = 10                  // Activation radius in meters
  @input
  @hint("Use custom prefab for this waypoint instead of the default one from WorldController")
  useCustomPrefab: boolean = false                 // Toggle for custom prefab
  @input
  @allowUndefined
  @showIf("useCustomPrefab", true)
  @hint("Custom prefab to use for this specific waypoint")
  customPrefab: ObjectPrefab                       // Custom prefab override
}

/**
 * Legacy indoor navigation input (kept for compatibility)
 * NOTE: Indoor navigation functionality has been removed from GPS Quest v1.0
 * This is maintained only for legacy compatibility with existing projects.
 */
@typedef
export class CustomLocationPlaceInput {
  @input active: boolean = true                    // Whether this waypoint is active
  @input locatedAt: LocatedAtComponent            // Indoor location component (unused)
  @input center: SceneObject                      // Center object (unused)
  @input label: string                            // Display name
  @input distanceToActivate: number = 10          // Activation radius (unused)
  @input
  @hint("Use custom prefab for this waypoint instead of the default one from WorldController")
  useCustomPrefab: boolean = false                // Toggle for custom prefab
  @input
  @allowUndefined
  @showIf("useCustomPrefab", true)
  @hint("Custom prefab to use for this specific waypoint")
  customPrefab: ObjectPrefab                      // Custom prefab override
}

/**
 * GPS Quest v1.0 - Manual Place List Manager
 * 
 * Manages a collection of GPS waypoints for outdoor navigation quests.
 * This component has been simplified from the original Navigation Kit to focus
 * exclusively on outdoor GPS-based waypoints for Spectacles.
 * 
 * Cleanup Notes:
 * - Removed icon and description inputs (not needed for outdoor GPS)
 * - Removed indoor navigation components  
 * - Added custom prefab functionality for individual waypoints
 * - Simplified to work only with GPS coordinates
 * 
 * Usage:
 * 1. Add GPS coordinates (lat/lng) for each waypoint
 * 2. Set activation distance (how close user needs to be)
 * 3. Optionally set custom prefab for specific waypoints
 * 4. Component automatically creates GeoLocationPlace objects on start
 *
 * Original by: Snap Inc.
 * Modified by: Pavlo Tkachenko
 * Website: pavlotkachenko.com
 *
 * @version 1.0.0 (GPS Quest - Simplified)
 */
@component
export class ManualPlaceList extends BaseScriptComponent {
  @input private navigationDataComponent: NavigationDataComponent    // Navigation system reference

  @ui.separator
  @input
  @label("Manual Geo Places")
  private readonly placeInputs: GeoPlaceInput[]                     // Array of GPS waypoint definitions

  /**
   * Initialize component and set up start event binding
   */
  private onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.start()
    })
  }

  /**
   * Create and register all active GPS waypoints with the navigation system
   * Called automatically on scene start
   */
  private start(): void {
    const userPosition = this.navigationDataComponent.getUserPosition()

    // Process each GPS waypoint input
    this.placeInputs.forEach((m) => {
      if (m.active) {
        // Create GPS position from string coordinates
        const geoPosition = GeoPosition.create()
        geoPosition.longitude = convertToNumber(m.longitude)
        geoPosition.latitude = convertToNumber(m.latitude)

        // Create GeoLocationPlace with GPS coordinates
        const place = new GeoLocationPlace(
          geoPosition,                                      // GPS coordinates
          m.distanceToActivate,                            // Activation radius in meters
          m.label,                                         // Waypoint display name
          null,                                            // icon removed (not needed for outdoor GPS)
          null,                                            // description removed (not needed for outdoor GPS)
          userPosition,                                    // User position tracker
          m.useCustomPrefab ? m.customPrefab : undefined,  // Custom prefab if specified
        )
        
        // Register waypoint with navigation system
        this.navigationDataComponent.addPlace(place)
      }
    })
  }
}
