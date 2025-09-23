import Event, {PublicApi, callback} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {MapParameter, calculateZoomOffset, findScriptComponent} from "./MapUtils"

import {GeoLocationPlace} from "SpectaclesNavigationKit.lspkg/NavigationDataComponent/GeoLocationPlace"
import {MapController} from "./MapController"
import {MapPin} from "./MapPin"
import {NavigationDataComponent} from "SpectaclesNavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent"
import {Place} from "SpectaclesNavigationKit.lspkg/NavigationDataComponent/Place"
import {UserPosition} from "SpectaclesNavigationKit.lspkg/NavigationDataComponent/UserPosition"

/**
 * Notification data for map toggle events
 */
export class MapToggledNotification {
  isMini: boolean              // Whether map is in mini mode
  happensInstantly: boolean    // Whether transition should be instant
}

/**
 * GPS Quest v1.0 - Map Component
 * 
 * Manages the minimap display and GPS visualization for outdoor navigation.
 * This component has been simplified from the original Navigation Kit to focus
 * exclusively on outdoor GPS-based navigation for Spectacles.
 * 
 * Cleanup Notes:
 * - Removed button controls and UI interactions (no buttons needed for outdoor GPS)
 * - Removed custom location features (GPS-only navigation)
 * - Removed pin color customization inputs (simplified interface)
 * - Removed scrolling controls (map follows user automatically)
 * - Simplified to work only with GPS coordinates and automatic positioning
 * 
 * Key Features:
 * - Minimap display with GPS tiles
 * - User position pin with orientation
 * - Waypoint pins for navigation
 * - Automatic map centering and rotation
 * - Zoom level control
 * - Map toggle between mini and full view
 * 
 * Usage:
 * - Automatically displays user location and waypoints on minimap
 * - Integrates with NavigationDataComponent for waypoint data
 * - Used by PanelManager for map visibility control
 * 
 * Original by: Snap Inc.
 * Modified by: Pavlo Tkachenko
 * Website: pavlotkachenko.com
 * 
 * @version 1.0.0 (GPS Quest - Simplified)
 */
@component
export class MapComponent extends BaseScriptComponent {
  @input
  tileCount: number = 2                          // Number of map tiles to load

  @input
  mapRenderParent: SceneObject                   // Parent object for map rendering

  @input
  navigationComponent: NavigationDataComponent   // Navigation system reference

  @ui.separator
  @ui.label("Zoom level: 8 far zoom , 21 close zoom")
  @input
  @widget(new SliderWidget(8, 21, 1))
  mapZoomLevel: number                           // Map zoom level (8=far, 21=close)
  @ui.separator
  @ui.label("If user pin should be shown in the map")
  @input
  showUserPin: boolean                           // Whether to show user position pin

  @ui.group_start("User Pin")
  @showIf("showUserPin", true)
  @input
  userPinVisual: ObjectPrefab                    // Visual prefab for user position pin
  @input
  userPinScale: vec2                             // Scale of user pin in full map mode
  @input
  userPinMinimizedScale: number = 1              // Scale of user pin in mini map mode
  @input
  userPinAlignedWithOrientation: boolean         // Whether user pin rotates with orientation
  @ui.group_end
  @ui.separator
  @ui.label("Map Pins")
  @ui.label("Make sure your Pin Prefab has ScreenTransform")
  @input
  mapPinPrefab: ObjectPrefab                     // Prefab for waypoint pins
  @input
  @hint("All the map pins will rotate according to map rotation if enabled")
  mapPinsRotated: boolean                        // Whether waypoint pins rotate with map
  @ui.separator
  @ui.label("Rotations")
  @input
  isMinimapAutoRotate: boolean                   // Whether minimap auto-rotates with user
  @input
  enableMapSmoothing: boolean                    // Whether to smooth map movement
  @ui.label("How often map should be updated (seconds)")
  @input
  mapUpdateThreshold: number                     // Map update frequency in seconds

  // Internal components and references
  private componentPrefab: ObjectPrefab = requireAsset("../Prefabs/Map Controller.prefab") as ObjectPrefab
  private mapController: MapController           // Core map rendering controller
  private userPosition: UserPosition             // User's GPS position tracker

  // Events for external components to subscribe to
  private onMiniMapToggledEvent = new Event<MapToggledNotification>()
  onMiniMapToggled: PublicApi<MapToggledNotification> = this.onMiniMapToggledEvent.publicApi()

  private placeSelectedEvent = new Event<Place>()
  public onPlaceSelected = this.placeSelectedEvent.publicApi()

  private onUserPositionSetEvent = new Event<GeoPosition>()
  public onUserPositionSet = this.onUserPositionSetEvent.publicApi()

  /**
   * Returns true if the map system is fully initialized
   */
  public get isInitialized(): boolean {
    return this.mapController?.isInitialized ?? false
  }

  /**
   * Initialize component and bind start event
   */
  onAwake() {
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this))
  }

  /**
   * Initialize map system with GPS Quest configuration
   * Sets up map controller with outdoor navigation parameters
   */
  onStart() {
    // Instantiate map controller from prefab
    const mapComponentInstance = this.componentPrefab.instantiate(this.getSceneObject())
    this.mapController = findScriptComponent(mapComponentInstance, "isMapComponent") as MapController

    // Set up default map location (will be overridden by user GPS position)
    let mapLocation: GeoPosition = null
    mapLocation = GeoPosition.create()
    try {
      Object.defineProperty(mapLocation, 'longitude', { value: 0.0, writable: true })
      Object.defineProperty(mapLocation, 'latitude', { value: 0.0, writable: true })
    } catch (e) {
      // If can't set properties, the map will follow user position automatically
      print('Using default map center')
    }

    const mapFocusPosition = new vec2(0.5, 0.5)  // Center of map

    // Configure map parameters for GPS Quest outdoor navigation
    const mapParameters: MapParameter = {
      tileCount: this.tileCount,
      renderParent: this.mapRenderParent,
      mapUpdateThreshold: this.mapUpdateThreshold,
      setMapToCustomLocation: false,               // Follow user position
      mapLocation: mapLocation,
      mapFocusPosition: mapFocusPosition,
      userPinVisual: this.userPinVisual,
      showUserPin: this.showUserPin,
      zoomLevel: this.mapZoomLevel,
      zoomOffet: calculateZoomOffset(this.mapZoomLevel),
      enableScrolling: false,                      // No manual scrolling for outdoor GPS
      scrollingFriction: 0,
      userPinScale: this.userPinScale,
      userPinMinimizedScale: this.userPinMinimizedScale,
      mapPinsRotated: this.mapPinsRotated,
      isMinimapAutoRotate: this.isMinimapAutoRotate,
      userPinAlignedWithOrientation: this.userPinAlignedWithOrientation,
      enableMapSmoothing: this.enableMapSmoothing,
      mapPinPrefab: this.mapPinPrefab,
      mapPinCursorDetectorSize: 0.02,
      highlightPinColor: new vec4(1, 0.82, 0.0, 1),    // Default pin colors
      selectedPinColor: new vec4(0.82, 1.0, 0.0, 1),
    }

    // Initialize map system with navigation component
    this.userPosition = this.navigationComponent.getUserPosition()
    this.mapController.initialize(mapParameters, this.navigationComponent, false)
    
    // Subscribe to user position updates
    this.mapController.onUserLocationSet.add((pos) => {
      this.onUserPositionSetEvent.invoke(pos)
    })
  }

  // #region Public API Functions
  // Core functionality exposed to other components
  // =====

  // #region Event Subscription Methods
  // Methods for other components to subscribe to map events

  /**
   * Subscribe to map tiles loaded event
   * Called when all initial map tiles have finished loading
   */
  subscribeOnMaptilesLoaded(fn: () => void): void {
    this.mapController.onMapTilesLoaded.add(fn)
  }

  /**
   * Subscribe to initial location set event
   * Called when map's initial center location is established
   */
  subscribeOnInitialLocationSet(fn: () => void): void {
    this.mapController.onInitialLocationSet.add(fn)
  }

  /**
   * Subscribe to user location first set event
   * Called when user's GPS position is first determined
   */
  subscribeOnUserLocationFirstSet(fn: () => void): void {
    this.mapController.onUserLocationSet.add(fn)
  }

  /**
   * Setting function to call when new tile comes into the view
   */
  subscribeOnTileCameIntoView(fn: () => void): void {
    this.mapController.onTileCameIntoView.add(fn)
  }

  /**
   * Setting function to call when tile goes out of the view
   */
  subscribeOnTileWentOutOfView(fn: () => void): void {
    this.mapController.onTileWentOutOfView.add(fn)
  }

  /**
   * Setting function to call when the map is centered
   */
  subscribeOnMapCentered(fn: callback<void>): void {
    this.mapController.onMapCentered.add(fn)
  }

  /**
   * Setting function to call when a new map pin is added
   */
  subscribeOnMapAddPin(fn: callback<MapPin>): void {
    this.mapController.onMapPinAdded.add(fn)
  }

  /**
   * Setting function to call when a map pin is removed
   */
  subscribeOnMapPinRemoved(fn: callback<MapPin>): void {
    this.mapController.onMapPinRemoved.add(fn)
  }

  /**
   * Setting function to call when all map pins are
   * removed from the map
   */
  subscribeOnAllMapPinsRemoved(fn: callback<void>): void {
    this.mapController.onAllMapPinsRemoved.add(fn)
  }

  /**
   * Setting function to call when the map is scrolled
   */
  subscribeOnMapScrolled(fn: callback<void>): void {
    this.mapController.onMapScrolled.add(fn)
  }

  /**
   * Setting function to call when no nearby places are found
   */
  subscribeOnNoNearbyPlacesFound(fn: callback<void>): void {
    this.mapController.onNoNearbyPlacesFound.add(fn)
  }

  /**
   * Setting function to call when nearby places call fails
   */
  subscribeOnNearbyPlacesFailed(fn: callback<void>): void {
    this.mapController.onNearbyPlacesFailed.add(fn)
  }

  // #endregion

  /**
   * Get the GPS coordinates of the initial map center
   * 
   * @returns GPS coordinates of map's center tile
   */
  getInitialMapTileLocation(): GeoPosition {
    return this.mapController.getInitialMapTileLocation()
  }

  /**
   * Update the user position tracker used by the map
   * 
   * @param userPosition - New user position tracker
   */
  setUserPosition(userPosition: UserPosition): void {
    this.userPosition = userPosition
  }

  /**
   * Update the navigation data component used by the map
   * 
   * @param data - Navigation component with waypoint data
   */
  setNavigationData(data: NavigationDataComponent): void {
    this.navigationComponent = data
  }

  /**
   * Setting if the user pin should be rotated with user orientation
   */
  setUserPinRotated(value: boolean): void {
    this.mapController.setUserPinRotated(value)
  }


  /**
   * Create a waypoint pin at specified GPS coordinates
   * 
   * @param longitude - GPS longitude
   * @param latitude - GPS latitude
   * @param visitDistance - Activation distance in meters
   * @returns Created map pin
   */
  createMapPin(longitude: number, latitude: number, visitDistance: number): MapPin {
    const location = GeoPosition.create()
    location.longitude = longitude
    location.latitude = latitude
    const place = new GeoLocationPlace(location, visitDistance, null, null, "User created map pin.", this.userPosition)
    return this.createMapPinFromPlace(place)
  }

  /**
   * Create a map pin from an existing Place object
   * 
   * @param place - Place object to create pin for
   * @returns Created map pin
   */
  createMapPinFromPlace(place: Place): MapPin {
    return this.mapController.createMapPin(place)
  }

  /**
   * Create a new map pin at the user location
   */
  createMapPinAtUserLocation(): MapPin {
    return this.mapController.createMapPinAtUserLocation()
  }

  /**
   * Add a map pin to the map by local position.
   * @param localPosition (0, 0) is the center of the map while (1, 1) is the top right corner and (-1, -1) is the bottom left corner
   */
  addPinByLocalPosition(localPosition: vec2): MapPin {
    return this.mapController.addPinByLocalPosition(localPosition)
  }

  /**
   * For removing a map pin from the map
   */
  removeMapPin(mapPin: MapPin): void {
    this.mapController.removeMapPin(mapPin)
  }

  /**
   * For removing all map pins from map
   */
  removeMapPins(): void {
    this.mapController.removeMapPins()
  }

  /**
   * @returns All map pins currently in use.
   */
  getMapPins(): MapPin[] {
    return this.mapController.getPins()
  }

  /**
   * Center the map to its initial location
   * Used to reset map view to starting position
   */
  centerMap(): void {
    if (this.mapController !== undefined) {
      this.mapController.centerMap()
    }
  }

  /**
   * Set the map to focus on a specific GPS location
   * 
   * @param position - GPS coordinates to center map on
   */
  setMapPosition(position: GeoPosition): void {
    this.mapController.setNewMapLocation(position)
  }

  /**
   * Check if the map is currently centered
   * 
   * @returns true if map is at center position
   */
  isMapCentered(): boolean {
    return this.mapController.isMapCentered()
  }

  /**
   * Update the hover position on the map to detect the hovered map pin
   * @param localPosition (0, 0) is the center of the map while (1, 1) is the top right corner and (-1, -1) is the bottom left corner
   */
  updateHover(localPosition: vec2): void {
    this.mapController.handleHoverUpdate(localPosition)
  }

  /**
   * Start touch on the map for map scrolling
   * @param localPosition (0, 0) is the center of the map while (1, 1) is the top right corner and (-1, -1) is the bottom left corner
   */
  startTouch(localPosition: vec2): void {
    this.mapController.handleTouchStart(localPosition)
  }

  /**
   * Update touch on the map for map scrolling
   * @param localPosition (0, 0) is the center of the map while (1, 1) is the top right corner and (-1, -1) is the bottom left corner
   */
  updateTouch(localPosition: vec2): void {
    this.mapController.handleTouchUpdate(localPosition)
  }

  /**
   * End touch on the map for map scrolling
   * @param localPosition (0, 0) is the center of the map while (1, 1) is the top right corner and (-1, -1) is the bottom left corner
   */
  endTouch(localPosition: vec2): void {
    this.mapController.handleTouchEnd(localPosition)
  }

  /**
   * Zooming in the map
   */
  zoomIn(): void {
    this.mapController.handleZoomIn()
  }

  /**
   * Zooming out the map
   */
  zoomOut(): void {
    this.mapController.handleZoomOut()
  }

  setZoom(zoomLevel: number): void {
    this.mapController.setZoomLevel(zoomLevel)
  }

  /**
   * Toggle between minimap and full map view
   * Main method used by PanelManager to control map visibility
   * 
   * @param isOn - true for minimap mode, false for full map
   * @param instantly - whether transition should be instant (no animation)
   */
  toggleMiniMap(isOn: boolean, instantly: boolean = false): void {
    this.mapController.toggleMiniMap(isOn, !instantly)
    
    // Notify other components of map toggle
    this.onMiniMapToggledEvent.invoke({isMini: isOn, happensInstantly: instantly})
  }


  /**
   * Drawing geometry point to map
   */
  drawGeometryPoint(geometry: any, radius: number): void {
    this.mapController.drawGeometryPoint(geometry, radius)
  }

  /**
   * Drawing geometry line to map
   */
  drawGeometryLine(geometry: any, thickness: number): void {
    this.mapController.drawGeometryLine(geometry, thickness)
  }

  /**
   * Drawing geometry multiline to map
   */
  drawGeometryMultiline(geometry: any, thickness: number): void {
    this.mapController.drawGeometryMultiline(geometry, thickness)
  }

  /**
   * Clearing all drawn geometry
   */
  clearGeometry(): void {
    this.mapController.clearGeometry()
  }

  // #endregion
}
