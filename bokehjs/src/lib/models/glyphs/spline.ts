import {XYGlyph, XYGlyphView, XYGlyphData} from "./xy_glyph"
import * as p from "core/properties"
import * as mixins from "core/property_mixins"
import * as visuals from "core/visuals"
import {NumberArray} from "core/types"
import {Context2d} from "core/util/canvas"

export interface SplineData extends XYGlyphData {
  _xt: NumberArray
  _yt: NumberArray
  sxt: NumberArray
  syt: NumberArray
}

export interface SplineView extends SplineData {}

export class SplineView extends XYGlyphView {
  model: Spline
  visuals: Spline.Visuals

  protected _interpolate(x: NumberArray, y: NumberArray, T: number = 10, tension: number = 0.5, closed: boolean = false): [NumberArray, NumberArray] {
    /** Catmull-Rom spline */
    const n = x.length
    const N = closed ? n + 1 : n

    const xx = new NumberArray(N + 2)
    const yy = new NumberArray(N + 2)
    xx.set(x, 1)
    yy.set(y, 1)

    if (closed) {
      xx[0] = x[n-1]
      yy[0] = y[n-1]
      xx[N] = x[0]
      yy[N] = y[0]
      xx[N+1] = x[1]
      yy[N+1] = y[1]
    } else {
      xx[0] = x[0]
      yy[0] = y[0]
      xx[N+1] = x[n-1]
      yy[N+1] = y[n-1]
    }

    const basis = new NumberArray(4*(T + 1))
    for (let j = 0, k = 0; j <= T; j++) {
      const t = j/T
      const t_2 = t**2
      const t_3 = t*t_2
      basis[k++] =  2*t_3 - 3*t_2 + 1 // h00
      basis[k++] = -2*t_3 + 3*t_2     // h01
      basis[k++] =    t_3 - 2*t_2 + t // h10
      basis[k++] =    t_3 -   t_2     // h11
    }

    const xt = new NumberArray(N*(T + 1))
    const yt = new NumberArray(N*(T + 1))

    for (let i = 1, k = 0; i <= N; i++) {
      const t0x = (xx[i+1] - xx[i-1])*tension
      const t0y = (yy[i+1] - yy[i-1])*tension
      const t1x = (xx[i+2] - xx[i])*tension
      const t1y = (yy[i+2] - yy[i])*tension

      for (let j = 0; j <= 4*T; k++) {
        const h00 = basis[j++]
        const h01 = basis[j++]
        const h10 = basis[j++]
        const h11 = basis[j++]

        xt[k] = h00*xx[i] + h01*xx[i+1] + h10*t0x + h11*t1x
        yt[k] = h00*yy[i] + h01*yy[i+1] + h10*t0y + h11*t1y
      }
    }

    return [xt, yt]
  }

  protected _set_data(): void {
    const {tension, closed} = this.model
    ;[this._xt, this._yt] = this._interpolate(this._x, this._y, 20, tension, closed)
  }

  protected _map_data(): void {
    const {x_scale, y_scale} = this.renderer.coordinates
    this.sxt = x_scale.v_compute(this._xt)
    this.syt = y_scale.v_compute(this._yt)
  }

  protected _render(ctx: Context2d, _indices: number[], {sxt: sx, syt: sy}: SplineData): void {
    this.visuals.line.set_vectorize(ctx, 0)

    const n = sx.length
    for (let j = 0; j < n; j++) {
      if (j == 0) {
        ctx.beginPath()
        ctx.moveTo(sx[j], sy[j])
        continue
      } else if (isNaN(sx[j]) || isNaN(sy[j])) {
        ctx.stroke()
        ctx.beginPath()
        continue
      } else
        ctx.lineTo(sx[j], sy[j])
    }
    ctx.stroke()
  }
}

export namespace Spline {
  export type Attrs = p.AttrsOf<Props>

  export type Props = XYGlyph.Props & Mixins & {
    tension: p.Property<number>
    closed: p.Property<boolean>
  }

  export type Mixins = mixins.LineVector

  export type Visuals = XYGlyph.Visuals & {line: visuals.Line}
}

export interface Spline extends Spline.Attrs {}

export class Spline extends XYGlyph {
  properties: Spline.Props
  __view_type__: SplineView

  constructor(attrs?: Partial<Spline.Attrs>) {
    super(attrs)
  }

  static init_Spline(): void {
    this.prototype.default_view = SplineView

    this.mixins<Spline.Mixins>(mixins.LineVector)

    this.define<Spline.Props>({
      tension: [ p.Number,  0.5   ],
      closed:  [ p.Boolean, false ],
    })
  }
}
