import {MapComponent} from "MapComponent/Scripts/MapComponent"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {delayAFrame} from "./DelayAFrame"

/**
 * GPS Quest v1.0 - Panel Manager
 * 
 * Manages map initialization and layer setup for outdoor GPS navigation.
 * This component has been drastically simplified from the original Navigation Kit
 * to focus exclusively on outdoor GPS minimap functionality for Spectacles.
 * 
 * Original Cleanup (330+ lines → ~75 lines):
 * - Removed all complex minimization UI logic
 * - Removed scrolling controls and place list management
 * - Removed button interactions and touch handling
 * - Removed indoor navigation panel switching
 * - Simplified to only handle map initialization and layer setup
 * 
 * Key Features:
 * - Initializes minimap for outdoor GPS navigation
 * - Sets up circular minimap layer rendering
 * - Provides map ready event for other components
 * - Manages map centering and basic controls
 * 
 * Usage:
 * - Automatically initializes on scene start
 * - Sets up minimap for continuous GPS tracking
 * - Used by other components to check map readiness
 * 
 * Original by: Snap Inc.
 * Modified by: Pavlo Tkachenko
 * Website: pavlotkachenko.com
 * 
 * @version 1.0.0 (GPS Quest - Drastically Simplified)
 */
@component
export class PanelManager extends BaseScriptComponent {
  // Core components for outdoor GPS navigation
  @input private mapComponent: MapComponent           // Reference to map system
  @input
  @allowUndefined
  private orthographicLayer: SceneObject              // Layer for circular minimap rendering

  // Events for notification of map system readiness
  private mapReadyEvent = new Event<boolean>()
  public onMapReady = this.mapReadyEvent.publicApi() // Event fired when map is ready

  /**
   * Initialize component and bind to start event
   */
  private onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.start()
    })
  }

  /**
   * Initialize map system for outdoor GPS navigation
   * 
   * Process:
   * 1. Center map to initial position
   * 2. Wait for map controller to be ready
   * 3. Enable minimap mode
   * 4. Set up circular rendering layer
   * 5. Notify other components map is ready
   */
  private async start(): Promise<void> {
    // Center map to initial position
    this.mapComponent.centerMap()
    
    // Wait a couple frames for proper initialization
    await delayAFrame()
    await delayAFrame()

    // Continuously check until map system is ready
    const checkReady = () => {
      if (this.mapComponent.isInitialized) {
        // Enable minimap mode for outdoor GPS navigation
        this.mapComponent.toggleMiniMap(true, false)
        
        // Set up orthographic layer for circular minimap rendering
        if (this.orthographicLayer) {
          this.setLayer(this.orthographicLayer.layer)
        }
        
        // Notify other components that map is ready
        this.mapReadyEvent.invoke(true)
      } else {
        // Keep checking until ready
        delayAFrame().then(checkReady)
      }
    }
    checkReady()
  }

  /**
   * Center the map to its initial position
   * Simplified method for outdoor GPS - no complex panel management
   */
  public centerMap(): void {
    this.mapComponent.centerMap()
  }
  
  /**
   * Check if the map system is fully initialized and ready
   * 
   * @returns true if map is ready for use
   */
  public isMapReady(): boolean {
    return this.mapComponent.isInitialized
  }


  /**
   * Set rendering layer for the entire minimap hierarchy
   * Required for proper circular minimap rendering
   * 
   * @param layer - LayerSet to apply to minimap
   */
  private setLayer(layer: LayerSet): void {
    this.setLayerRecursive(this.sceneObject, layer)
  }

  /**
   * Recursively apply layer to all child objects
   * Ensures entire minimap renders on correct layer
   * 
   * @param sceneObject - Object to apply layer to
   * @param layer - LayerSet to apply
   */
  private setLayerRecursive(sceneObject: SceneObject, layer: LayerSet) {
    sceneObject.layer = layer
    sceneObject.children.forEach((c) => this.setLayerRecursive(c, layer))
  }


}
