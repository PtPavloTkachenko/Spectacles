import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {LensConfig} from "SpectaclesInteractionKit.lspkg/Utils/LensConfig"

/**
 * GPS Quest v1.0 - Base Place Class
 * 
 * Abstract base class for waypoints in the GPS navigation system.
 * This class has been enhanced to support custom prefabs for individual waypoints
 * while maintaining compatibility with both GPS and simulation-based places.
 * 
 * Key Features Added:
 * - Custom prefab support for individual waypoints
 * - Optional constructor parameters for simplified GPS-only usage
 * - Maintained compatibility with existing navigation system
 * 
 * Cleanup Notes:
 * - Icon and description are still supported for backward compatibility
 * - but are typically set to null for GPS Quest outdoor navigation
 * - Custom prefab functionality allows each waypoint to have unique 3D appearance
 * 
 * Original by: Snap Inc.
 * Modified by: Pavlo Tkachenko
 * Website: pavlotkachenko.com
 * 
 * @version 1.0.0 (GPS Quest - Enhanced)
 */
export abstract class Place {
  private _name: string                        // Display name for the waypoint
  private _icon: Texture                       // Icon texture (optional, often null for GPS)
  private _description: string                 // Text description (optional, often null for GPS)
  private _visited: boolean = false            // Whether user has visited this waypoint
  private _customPrefab: ObjectPrefab         // Custom 3D prefab for this specific waypoint
  protected statusUpdateEvent = new Event<void>()  // Event fired when waypoint status changes

  /**
   * The display name of the waypoint
   */
  public get name(): string {
    return this._name
  }

  /**
   * Icon texture associated with the waypoint
   * Note: Often null in GPS Quest outdoor navigation
   */
  public get icon(): Texture {
    return this._icon
  }
  
  /**
   * Text description of the waypoint
   * Note: Often null in GPS Quest outdoor navigation
   */
  public get description(): string {
    return this._description
  }

  /**
   * Returns true if this waypoint has been visited by the user
   */
  public get visited(): boolean {
    return this._visited
  }

  /**
   * Marks waypoint as visited or unvisited
   */
  public set visited(value: boolean) {
    this._visited = value
  }

  /**
   * Returns the custom 3D prefab for this waypoint, if set
   * Used by WorldController to override default waypoint appearance
   */
  public get customPrefab(): ObjectPrefab {
    return this._customPrefab
  }

  /**
   * Sets a custom 3D prefab for this specific waypoint
   * Allows individual waypoints to have unique appearances
   */
  public set customPrefab(value: ObjectPrefab) {
    this._customPrefab = value
  }

  /**
   * Returns true if the waypoint is ready for navigation
   * Default implementation always returns true
   */
  public get ready(): boolean {
    return true
  }

  /**
   * Returns the 3D world position relative to user's starting position
   * Used by WorldController to position waypoint objects in 3D space
   */
  public abstract getRelativePosition(): vec3 | null

  /**
   * Returns the GPS coordinates (latitude, longitude, altitude)
   * Used for distance calculations and navigation
   */
  public abstract getGeoPosition(): GeoPosition | null

  /**
   * Returns the orientation of the waypoint as a quaternion
   * Used to orient 3D waypoint objects in world space
   */
  public abstract getOrientation(): quat

  /**
   * Updates the GPS position of this waypoint
   * 
   * @param geoPosition - New GPS coordinates
   * @returns true if position update was accepted
   */
  public abstract requestNewGeoPosition(geoPosition: GeoPosition): boolean

  /**
   * Event triggered when waypoint status changes (visited state, position, etc.)
   * Used by navigation system to respond to waypoint updates
   */
  public onStatusUpdated = this.statusUpdateEvent.publicApi()

  /**
   * Creates a new waypoint
   * 
   * @param name - Display name for the waypoint
   * @param icon - Texture icon (can be null for GPS Quest)
   * @param description - Text description (can be null for GPS Quest) 
   * @param customPrefab - Optional custom 3D prefab for this waypoint
   */
  constructor(name: string, icon: Texture, description: string, customPrefab?: ObjectPrefab) {
    this._name = name
    this._icon = icon
    this._description = description
    this._customPrefab = customPrefab

    // Set up automatic visited state checking
    const updateDispatcher = LensConfig.getInstance().updateDispatcher
    updateDispatcher.createUpdateEvent("UpdateEvent").bind(() => {
      if (this.checkVisited()) {
        this._visited = true
      }
    })
  }

  /**
   * Abstract method to check if waypoint should be marked as visited
   * Implemented by subclasses with specific logic (e.g., distance-based for GPS)
   * 
   * @returns true if waypoint should be marked as visited
   */
  protected abstract checkVisited(): boolean
}
