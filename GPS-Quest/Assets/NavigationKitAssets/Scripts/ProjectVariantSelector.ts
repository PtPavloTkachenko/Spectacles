import {NavigationDataComponent} from "SpectaclesNavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent"
import {delayAFrame} from "./DelayAFrame"
import {PanelManager} from "./PanelManager"

/**
 * Selects a project variant.
 */
@component
export class ProjectVariantSelector extends BaseScriptComponent {
  @input private navigationComponent: NavigationDataComponent
  @input private panelManager: PanelManager
  @input private outdoorObjects: SceneObject[] = []
  @input private uiRoot: SceneObject

  private onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.start())
  }

  private async start(): Promise<void> {
    await delayAFrame()
    this.initializeOutdoors()
  }

  private async initializeOutdoors(): Promise<void> {
    this.uiRoot.enabled = true
    await delayAFrame()
    const userPosition = this.navigationComponent.getUserPosition()
    userPosition.initializeGeoLocationUpdates(GeoLocationAccuracy.Navigation, 1.0)

    this.outdoorObjects.forEach((e) => (e.enabled = true))
    this.panelManager.centerMap()
  }
}
