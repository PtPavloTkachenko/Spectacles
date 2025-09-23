import {LensConfig} from "SpectaclesInteractionKit.lspkg/Utils/LensConfig"
import {UpdateDispatcher} from "SpectaclesInteractionKit.lspkg/Utils/UpdateDispatcher"

/**
 * Gives a bounce to the direction arrow.
 */
@component
export class ArrowAnimator extends BaseScriptComponent {
  private transform: Transform
  private startTime = getTime()
  private updateDispatcher: UpdateDispatcher = LensConfig.getInstance().updateDispatcher

  // --- ANIMATION VALUES ---
  private startPos = new vec3(0, -0.5, 0.5)
  private endPos = new vec3(0, 0.5, -0.5)
  @input
  private startScale = new vec3(55, 45, 45)
  @input
  private endScale = new vec3(50, 50, 50)
  // 0.6 forward + 0.6 backward
  private loopDuration = 1.2
  private scaleDelay = 0.15

  private onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.transform = this.getTransform()
      const localPosition = this.transform.getLocalPosition()
      this.startPos = this.startPos.add(localPosition)
      this.endPos = this.endPos.add(localPosition)
    })

    this.updateDispatcher.createUpdateEvent("UpdateEvent").bind(() => {
      const currentTime = getTime() - this.startTime

      // --- POSITION ---
      const tPos = getPingPongT(currentTime, this.loopDuration)
      const easedTPos = cubicOut(tPos)
      const currentPos = vec3.lerp(this.startPos, this.endPos, easedTPos)
      this.transform.setLocalPosition(currentPos)

      // --- SCALE (with delay) ---
      const scaleTime = currentTime - this.scaleDelay
      if (scaleTime >= 0) {
        const tScale = getPingPongT(scaleTime, this.loopDuration)
        const easedTScale = cubicOut(clamp(tScale, 0, 1))
        const currentScale = vec3.lerp(this.startScale, this.endScale, easedTScale)
        this.transform.setLocalScale(currentScale)
      }
    })

    function cubicOut(t) {
      const f = t - 1.0
      return f * f * f + 1.0
    }

    function clamp(val, min, max) {
      return Math.max(min, Math.min(max, val))
    }

    function getPingPongT(time, duration) {
      const phase = time % duration
      const half = duration * 0.5
      return phase < half ? phase / half : 1 - (phase - half) / half
    }
  }
}
