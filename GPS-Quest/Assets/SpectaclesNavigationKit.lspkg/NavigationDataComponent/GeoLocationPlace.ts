import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"
import {calculateBearing, getPhysicalDistanceBetweenLocations, normalizeAngle} from "./NavigationUtils"
import {Place} from "./Place"
import {UserPosition, UserPositionStatus} from "./UserPosition"

const TAG = "[GeoLocationPlace]"
const log = new NativeLogger(TAG)

/**
 * GPS Quest v1.0 - GPS-Based Waypoint
 * 
 * Represents a waypoint positioned using GPS coordinates (latitude/longitude).
 * This class handles conversion between GPS coordinates and 3D world positions
 * for outdoor navigation in Spectacles.
 * 
 * Key Features:
 * - GPS coordinate storage and management
 * - Distance-based activation (user must be within specified meters)
 * - Automatic position calculation relative to user's starting location
 * - Bearing calculation for navigation direction
 * - Custom prefab support for individual waypoint appearance
 * 
 * Usage in GPS Quest:
 * - Created automatically by ManualPlaceList from GPS coordinate inputs
 * - Positioned in 3D world space by WorldController
 * - Activated when user comes within specified distance
 * 
 * Original by: Snap Inc.
 * Modified by: Pavlo Tkachenko
 * Website: pavlotkachenko.com
 * 
 * @version 1.0.0 (GPS Quest - Enhanced)
 */
export class GeoLocationPlace extends Place {
  protected readonly userPosition: UserPosition    // Reference to user's GPS position tracker
  private readonly distanceToVisit: number         // Activation distance in meters
  protected geoPosition: GeoPosition               // GPS coordinates of this waypoint

  /**
   * Creates a GPS-based waypoint
   * 
   * @param geoPosition - GPS coordinates (lat/lng/altitude)
   * @param distanceToVisit - Activation radius in meters
   * @param name - Display name for waypoint
   * @param icon - Texture icon (typically null for GPS Quest)
   * @param description - Text description (typically null for GPS Quest)
   * @param userPosition - User's GPS position tracker
   * @param customPrefab - Optional custom 3D prefab for this waypoint
   */
  constructor(
    geoPosition: GeoPosition,
    distanceToVisit: number,
    name: string,
    icon: Texture,
    description: string,
    userPosition: UserPosition,
    customPrefab?: ObjectPrefab,
  ) {
    super(name, icon, description, customPrefab)
    this.userPosition = userPosition
    this.geoPosition = geoPosition
    this.distanceToVisit = distanceToVisit
  }

  /**
   * Returns the GPS coordinates of this waypoint
   */
  public getGeoPosition(): GeoPosition | null {
    return this.geoPosition
  }

  /**
   * Updates the GPS position of this waypoint
   * Always returns true (GPS waypoints can be moved)
   */
  public requestNewGeoPosition(geoPosition: GeoPosition): boolean {
    this.geoPosition = geoPosition
    return true
  }

  /**
   * Returns 3D world position relative to user's starting location
   * Used by WorldController to position waypoint objects
   */
  public getRelativePosition(): vec3 | null {
    return this.calculateRelativePosition(0)
  }

  /**
   * Returns waypoint orientation (identity quaternion for GPS waypoints)
   */
  public getOrientation(): quat {
    return quat.quatIdentity()
  }

  /**
   * Calculates physical distance in meters between user and this waypoint
   * 
   * @param userPosition - User's current GPS position
   * @returns Distance in meters, or null if GPS unavailable
   */
  private getPhysicalDistance(userPosition: UserPosition): number | null {
    const userGeoPosition = userPosition.getGeoPosition()
    if (isNull(userGeoPosition)) {
      return null
    }
    return getPhysicalDistanceBetweenLocations(userGeoPosition, this.getGeoPosition())
  }

  /**
   * Calculates 3D world position from GPS coordinates
   * Converts GPS lat/lng to world space relative to user's starting position
   * 
   * @param yOffset - Additional Y-axis offset
   * @returns 3D position in world space, or null if calculation fails
   */
  protected calculateRelativePosition(yOffset: number): vec3 | null {
    const userTransform = this.userPosition.getRelativeTransform()
    const cameraForward = userTransform.back
    const userForward = cameraForward.projectOnPlane(vec3.up()).normalize()
    const distance = this.getPhysicalDistance(this.userPosition)
    const bearing = this.getBearing(this.userPosition) - this.userPosition.getBearing()
    const pinAltitude = this.getGeoPosition().altitude
    const userAltitude = this.userPosition.getGeoPosition()?.altitude ?? 0

    // Calculate position using distance and bearing from user
    const projectedPosition: vec3 = this.userPosition
      .getRelativeTransform()
      .getWorldPosition()
      .add(
        quat
          .fromEulerAngles(0, -bearing, 0)
          .multiplyVec3(userForward)
          .uniformScale(distance * 100),  // Scale distance for world space
      )
      .add(new vec3(0, yOffset + (pinAltitude - userAltitude) * 100, 0))

    // Keep waypoint at user's ground level
    projectedPosition.y = userTransform.getWorldPosition().y
    return projectedPosition
  }

  /**
   * Calculates bearing (compass direction) from user to this waypoint
   * 
   * @param userPosition - User's current GPS position
   * @returns Bearing angle in degrees, or null if GPS unavailable
   */
  public getBearing(userPosition: UserPosition): number | null {
    if (userPosition.status !== UserPositionStatus.GeoLocalizationAvailable) {
      log.i("Bearing requested, but user position is " + userPosition.status)
      return null
    }
    const userGeoPosition = userPosition.getGeoPosition()
    const locationBearing = calculateBearing(userGeoPosition, this.getGeoPosition())
    return normalizeAngle(locationBearing)
  }

  /**
   * Checks if user is close enough to mark waypoint as visited
   * Called automatically by the base Place class update loop
   * 
   * @returns true if user is within activation distance
   */
  protected checkVisited(): boolean {
    const distance = this.getPhysicalDistance(this.userPosition)
    return !isNull(distance) && distance < this.distanceToVisit
  }
}
