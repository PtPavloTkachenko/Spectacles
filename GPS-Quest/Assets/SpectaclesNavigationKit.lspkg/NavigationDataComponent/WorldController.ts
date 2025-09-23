//@ts-ignore
const vec3 = global.vec3;
import {NavigationDataComponent} from "./NavigationDataComponent"
import {Place} from "./Place"

/**
 * GPS Quest v1.0 - World Controller
 * 
 * Manages 3D waypoint spawning and animation states for outdoor GPS navigation.
 * This controller has been simplified from the original Navigation Kit to focus
 * exclusively on outdoor GPS waypoints with tween animations for Spectacles.
 * 
 * Cleanup Notes:
 * - Removed metrics tracking and audio systems
 * - Simplified status management (removed complex UI states)
 * - Added custom prefab support for individual waypoints
 * - Focused on GPS-based waypoint spawning only
 * - Kept tween animation system for waypoint state transitions
 * 
 * Key Features:
 * - Automatic waypoint spawning from GPS coordinates
 * - Custom prefab support (per waypoint or default)
 * - Tween animations for waypoint states (onSpawn, onVisited, onPassed)
 * - Position smoothing for GPS coordinate updates
 * - Text component updates for waypoint names
 * 
 * Waypoint States:
 * - onSpawn: Next waypoint to visit
 * - onVisited: Currently active waypoint
 * - onPassed: Previously completed waypoints
 * 
 * Author: Pavlo Tkachenko
 * Website: pavlotkachenko.com
 * 
 * @version 1.0.0 (GPS Quest - Simplified)
 */
@component
export class WorldController extends BaseScriptComponent {
  @input
  private navigationDataComponent: NavigationDataComponent;          // Reference to navigation system

  @input
  private placePrefab: ObjectPrefab;                                // Default prefab for waypoints
  @input
  @allowUndefined
  private firstLastPrefab: ObjectPrefab;                            // Special prefab for start/finish waypoints

  @input
  private autoSpawn: boolean = true;                                // Auto-spawn waypoints on start

  @input
  private smoothingFactor: number = 0.1;                            // GPS position smoothing factor

  // Internal state tracking
  private spawnedPlaces = new Map<Place, SceneObject>();             // Maps places to spawned 3D objects
  private container: SceneObject;                                   // Container for spawned waypoints
  private lastVisitedIndex: number = -1;                            // Index of last visited waypoint
  private placeStatusMap = new Map<SceneObject, string>();          // Tracks tween animation states

  /**
   * Initialize component, find container, and set up event bindings
   */
  private onAwake(): void {
    // Find or use Transform container for spawned waypoint objects
    const root = this.getSceneObject();
    let containerObj = root;
    for (let i = 0; i < root.getChildrenCount(); i++) {
      const child = root.getChild(i);
      if (child.name === "Transform") {
        containerObj = child;
        break;
      }
    }
    this.container = containerObj;

    // Subscribe to navigation events for waypoint state management
    this.navigationDataComponent.onNavigationStarted.add(this.onNavigationStarted.bind(this));
    this.navigationDataComponent.onArrivedAtPlace.add(this.onArrivedAtPlace.bind(this));
    this.navigationDataComponent.onPlacesUpdated.add(this.onPlacesUpdated.bind(this));

    // Start update loop for GPS position smoothing and waypoint visibility
    this.createEvent("UpdateEvent").bind(this.onUpdate.bind(this));
  }

  /**
   * Called when navigation starts - updates waypoint visibility
   */
  private onNavigationStarted(place: Place): void {
    this.updateWaypointVisibility();
  }

  /**
   * Called when user arrives at a waypoint - manages tween animation states
   * 
   * Animation Logic:
   * 1. Previous waypoint -> onPassed state
   * 2. Next waypoint -> onSpawn state  
   * 3. Current waypoint -> onVisited state (or onPassed if last)
   */
  private onArrivedAtPlace(place: Place): void {
    const places = this.navigationDataComponent.places;
    const currentIndex = places.indexOf(place);

    // 1. Trigger onPassed animation for previous waypoint
    if (this.lastVisitedIndex >= 0 && this.lastVisitedIndex < places.length) {
      const prevInstance = this.spawnedPlaces.get(places[this.lastVisitedIndex]);
      if (prevInstance) {
        this.triggerTweenChain(prevInstance, "onPassed");
        this.setPlaceText(prevInstance, "onPassed");
      }
    }

    // 2. Handle current and next waypoint states
    if (currentIndex + 1 < places.length) {
      // Not the last waypoint - activate next and mark current as visited
      const nextInstance = this.spawnedPlaces.get(places[currentIndex + 1]);
      if (nextInstance) {
        this.triggerTweenChain(nextInstance, "onSpawn");
        this.setPlaceText(nextInstance, "onSpawn");
      }
      
      const currentInstance = this.spawnedPlaces.get(place);
      if (currentInstance) {
        this.triggerTweenChain(currentInstance, "onVisited");
        this.setPlaceText(currentInstance, "onVisited");
      }
    } else {
      // Last waypoint - mark as passed (quest complete)
      const currentInstance = this.spawnedPlaces.get(place);
      if (currentInstance) {
        this.triggerTweenChain(currentInstance, "onPassed");
        this.setPlaceText(currentInstance, "onPassed");
      }
    }

    this.lastVisitedIndex = currentIndex;
  }

  /**
   * Called when places are updated - automatically spawns waypoints if enabled
   */
  private onPlacesUpdated(): void {
    if (this.autoSpawn) {
      this.spawnAllPlaces();
    }
  }

  /**
   * Spawns 3D objects for all registered waypoints
   * 
   * Prefab Priority:
   * 1. Custom prefab (if set on individual waypoint)
   * 2. First/Last prefab (for start/finish waypoints)
   * 3. Default place prefab
   */
  private spawnAllPlaces(): void {
    // Skip spawning if we don't have the required default prefab
    if (!this.placePrefab) {
      return;
    }
    
    const places = this.navigationDataComponent.places.slice();

    places.forEach((place, index) => {
      if (!this.spawnedPlaces.has(place)) {
        const label = place.name.toLowerCase();
        
        // Determine which prefab to use (priority: custom > first/last > default)
        let prefabToUse = this.placePrefab;
        if (place.customPrefab) {
          // Use custom prefab if specified on the waypoint
          prefabToUse = place.customPrefab;
        } else if ((label.includes("start") || label.includes("finish") || label.includes("end")) && this.firstLastPrefab) {
          // Use special prefab for start/finish waypoints
          prefabToUse = this.firstLastPrefab;
        }

        // Instantiate the 3D waypoint object
        const instance = prefabToUse.instantiate(this.container);

        // Position waypoint using GPS coordinates converted to world space
        const rel = place.getRelativePosition();
        if (rel) {
          instance.getTransform().setLocalPosition(rel);
          instance.getTransform().setLocalRotation(place.getOrientation());
        }

        // Set waypoint display text
        this.setPlaceText(instance, place.name);

        // Track spawned object for future updates
        this.spawnedPlaces.set(place, instance);
      }
    });
  }

  /**
   * Updates Text3D component on waypoint objects
   * Searches recursively through object hierarchy to find text component
   */
  private setPlaceText(instance: SceneObject, text: string): void {
    // First check the root object
    let textComp = instance.getComponent("Component.Text3D");
    
    // If not found, search children and grandchildren
    if (!textComp) {
      for (let i = 0; i < instance.getChildrenCount(); i++) {
        const child = instance.getChild(i);
        textComp = child.getComponent("Component.Text3D");
        if (textComp) break;
        
        // Search grandchildren
        for (let j = 0; j < child.getChildrenCount(); j++) {
          const grand = child.getChild(j);
          textComp = grand.getComponent("Component.Text3D");
          if (textComp) break;
        }
        if (textComp) break;
      }
    }
    
    // Update text if component found
    if (textComp) {
      textComp.text = text;
    }
  }

  /**
   * Called every frame - updates waypoint positions and animation states
   */
  private onUpdate(): void {
    this.updateWaypointVisibility();
  }

  /**
   * Updates waypoint positions and animation states every frame
   * 
   * Handles:
   * - GPS position smoothing for waypoint objects
   * - Animation state management based on quest progress
   * - Text updates for waypoint names
   */
  private updateWaypointVisibility(): void {
    const places = this.navigationDataComponent.places;

    places.forEach((place, index) => {
      const instance = this.spawnedPlaces.get(place);
      if (!instance) return;

      // Update position every frame (GPS coordinates may change)
      const rel = place.getRelativePosition();
      if (rel) {
        const transform = instance.getTransform();

        // Apply smooth position interpolation for GPS updates
        const currentPos = transform.getLocalPosition();
        const newPos = vec3.lerp(currentPos, rel, this.smoothingFactor);
        transform.setLocalPosition(newPos);
      }

      // Determine current waypoint status based on quest progress
      let status = "";
      if (index < this.lastVisitedIndex) {
        status = "onPassed";        // Previously completed waypoints
      } else if (index === this.lastVisitedIndex) {
        status = "onVisited";      // Currently active waypoint
      } else if (index === this.lastVisitedIndex + 1) {
        status = "onSpawn";        // Next waypoint to visit
      } else {
        status = place.name;       // Future waypoints (default state)
      }
      
      // Always display waypoint name
      this.setPlaceText(instance, place.name);

      // Trigger tween animation only when status changes
      const prevStatus = this.placeStatusMap.get(instance);
      if (status !== prevStatus) {
        if (status === "onPassed" || status === "onVisited" || status === "onSpawn") {
          this.triggerTweenChain(instance, status);
        }
        this.placeStatusMap.set(instance, status);
      }
    });
  }

  /**
   * Triggers tween animation chains on waypoint objects
   * 
   * Searches for TweenController child object and activates matching tween chain
   * 
   * @param instance - The waypoint object containing TweenController
   * @param chainName - Name of tween chain to trigger (onSpawn, onVisited, onPassed)
   */
  private triggerTweenChain(instance: SceneObject, chainName: string): void {
    // Find TweenController child object
    let tweenController: SceneObject | null = null;
    for (let i = 0; i < instance.getChildrenCount(); i++) {
      const child = instance.getChild(i);
      if (child.name === "TweenController") {
        tweenController = child;
        break;
      }
    }
    
    if (!tweenController) {
      return; // No tween controller found
    }

    // Find and trigger matching tween chain component
    const components = tweenController.getAllComponents();
    for (let i = 0; i < components.length; i++) {
      const comp = components[i] as any;
      if (comp.tweenName === chainName && comp.api && typeof comp.api.startTween === "function") {
        comp.api.startTween();
        break;
      }
    }
  }
}