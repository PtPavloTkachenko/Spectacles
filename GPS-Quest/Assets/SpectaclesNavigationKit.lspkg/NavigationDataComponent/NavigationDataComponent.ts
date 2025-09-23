require("LensStudio:RawLocationModule")

import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {LensConfig} from "SpectaclesInteractionKit.lspkg/Utils/LensConfig"
import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"
import {UpdateDispatcher} from "SpectaclesInteractionKit.lspkg/Utils/UpdateDispatcher"
import {EditableUserPosition} from "./EditableUserPosition"
import {Place} from "./Place"
import {UserPosition} from "./UserPosition"

const TAG = "[Navigation Component]"
const log = new NativeLogger(TAG)

/**
 * Tracks a set of {@link Place}s that can be used to create experiences that require the user to navigate to different
 * locations.
 *
 * @version 1.0.0
 */
@component
export class NavigationDataComponent extends BaseScriptComponent {
  private userPosition: EditableUserPosition
  private updateDispatcher: UpdateDispatcher = LensConfig.getInstance().updateDispatcher

  private _places: Place[] = []
  private _status = NavigationStatus.Initializing
  private selectedPlace: Place | null
  private placesVisited = new Map<Place, boolean>()
  private placesAt = new Map<Place, boolean>()
  private emittedAllVisited = false
  private hasArrivedAtSelectedPlace = false

  private navigationStartedEvent = new Event<Place>()
  public onNavigationStarted = this.navigationStartedEvent.publicApi()

  private arrivedAtEvent = new Event<Place>()
  public onArrivedAtPlace = this.arrivedAtEvent.publicApi()

  private placesUpdated = new Event<void>()
  public onPlacesUpdated = this.placesUpdated.publicApi()

  private allVisitedEvent = new Event<void>()
  public onAllPlacesVisited = this.allVisitedEvent.publicApi()

  @input private userCamera: Camera
  @ui.label("How often map should be updated (seconds), 0 for never")
  @input
  private updateThreshold: number = 1

  public get places(): Place[] {
    return this._places
  }

  /**
   * Represents the status of the navigation component.
   */
  public get status(): NavigationStatus {
    return this._status
  }

  private onAwake() {
    this.userPosition = new EditableUserPosition(this, this.userCamera.getTransform())
    if (this.updateThreshold > 0){
      this.userPosition.initializeGeoLocationUpdates(GeoLocationAccuracy.Navigation, this.updateThreshold)
    }

    const updateEvent = this.updateDispatcher.createUpdateEvent("UpdateEvent")
    updateEvent.bind(() => {
      this.update()
    })
  }

  /**
   * Represents the users position for navigation purposes.
   */
  public getUserPosition(): UserPosition {
    return this.userPosition
  }

  /**
   * Selects a {@link Place} to provide directions towards and triggers the tracking logic to navigate to the selected
   * location.
   */
  public navigateToPlace(place: Place): void {
    if (this.selectedPlace === place) {
      return
    }
    if (!this._places.includes(place) && !isNull(place)) {
      this.addPlace(place)
    }

    this._status = isNull(place) ? NavigationStatus.LocationNotSelected : NavigationStatus.InProgress
    this.update()
    this.selectedPlace = place
    this.hasArrivedAtSelectedPlace = false
    this.navigationStartedEvent.invoke(place)
  }

  /**
   * Ends the current navigation.
   */
  public stopNavigation(): void {
    this.navigateToPlace(null)
  }

  /**
   * Adds a new {@link Place} of interest to the guided experience.
   */
  public addPlace(place: Place): void {
    if (isNull(place)) {
      throw new Error("Null argument.")
    }

    if (!this._places.includes(place)) {
      this._places.push(place)
      this.placesVisited.set(place, false)
      this.placesAt.set(place, false)
      this.placesUpdated.invoke()
      this.emittedAllVisited = false
    } else {
      log.i("Attempted to add location already present in tracking. Ignored.")
    }
  }

  /**
   * Removes the provided {@link Place} from the guided experience.
   */
  public removePlace(place: Place): void {
    const sizeBefore = this._places.length
    this._places = this._places.filter((m) => m !== place)
    this.placesVisited.delete(place)
    this.placesAt.delete(place)

    if (this._places.length !== sizeBefore) {
      this.placesUpdated.invoke()
    }
  }

  private update(): void {
    // User placed pin navigation
    if (this.selectedPlace !== null && this.selectedPlace !== undefined) {
      // --- Додаємо автоперемикання на наступний вейпойнт ---
      const distance = this.userPosition.getDistanceTo(this.selectedPlace)
      const distanceToActivate = (this.selectedPlace as any).distanceToActivate ?? 10
      const currentIdx = this._places.indexOf(this.selectedPlace)
      const prev = this._places[currentIdx - 1]
      const prevVisited = !prev || prev.visited

      if (
        distance !== null &&
        distance <= distanceToActivate &&
        prevVisited &&
        !this.selectedPlace.visited
      ) {
        this.selectedPlace.visited = true
        this.arrivedAtEvent.invoke(this.selectedPlace)
        this.hasArrivedAtSelectedPlace = true
      }
      const atPlace = this.selectedPlace.visited
      if (atPlace) {
        this.arrivedAtEvent.invoke(this.selectedPlace)
        this.hasArrivedAtSelectedPlace = true
        if (this.hasArrivedAtSelectedPlace) {
          // --- Пошук наступного невідвіданого вейпойнта ---
          const currentIdx = this._places.indexOf(this.selectedPlace)
          let nextPlace = null
          for (let i = currentIdx + 1; i < this._places.length; i++) {
            if (!this._places[i].visited) {
              nextPlace = this._places[i]
              break
            }
          }
          if (nextPlace) {
            this.selectedPlace = null // Скидаємо, щоб navigateToPlace спрацював
            this.navigateToPlace(nextPlace)
          } else {
            this.selectedPlace = null
            this._status = NavigationStatus.Succeeded
          }
        }
      }
    }

    // Guided experience (strict sequential order)
    for (let i = 0; i < this._places.length; i++) {
      const p = this._places[i]
      const atPlace = p.visited
      if (atPlace !== this.placesAt.get(p)) {
        if (atPlace) {
          const isFirst = i === 0
          const prevVisited = isFirst || this._places[i - 1].visited
          if (prevVisited) {
            this.arrivedAtEvent.invoke(p)
            this.placesVisited.set(p, true)
            this.placesAt.set(p, true)
          } else {
            // Invalidate visited if previous wasn't visited (out of order)
            p.visited = false
          }
        } else {
          this.placesAt.set(p, false)
        }
      }
    }

    if (!this.emittedAllVisited) {
      let allVisited: boolean = this.placesVisited.size > 0

      this.placesVisited.forEach((visited, place) => {
        allVisited = allVisited && visited
      })

      if (allVisited) {
        this.emittedAllVisited = true
        this.allVisitedEvent.invoke()
      }
    }
  }
}

export enum NavigationStatus {
  LocationNotSelected,
  Initializing,
  InProgress,
  Succeeded,
}
