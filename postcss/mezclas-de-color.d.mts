import type { PluginCreator } from 'postcss'

export type ValoresDeTema = Record<string, string>

export function leerTemas(css?: string): { claro: ValoresDeTema; oscuro: ValoresDeTema }
export function mezclar(colorA: string, porcentaje: number, colorB: string): string

declare const mezclasDeColor: PluginCreator<void>
export default mezclasDeColor
