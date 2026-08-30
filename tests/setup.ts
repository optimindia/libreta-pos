import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Sin esto, cada render se acumula en el DOM y las pruebas siguientes
// encuentran elementos duplicados de la prueba anterior.
afterEach(() => {
  cleanup()
})
