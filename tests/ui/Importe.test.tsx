import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Importe } from '@/ui/sistema/Importe'

describe('Importe', () => {
  it('muestra el monto formateado en pesos', () => {
    render(<Importe centavos={18740000} />)
    expect(screen.getByText('$187.400')).toBeDefined()
  })

  it('siempre lleva la clase de números tabulares', () => {
    const { container } = render(<Importe centavos={100} />)
    expect(container.firstElementChild?.className).toContain('tabular')
  })

  it('el cero se muestra, no se oculta', () => {
    render(<Importe centavos={0} />)
    expect(screen.getByText('$0')).toBeDefined()
  })
})
