import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Sin esto, cada render se acumula en el DOM y las pruebas siguientes
// encuentran elementos duplicados de la prueba anterior.
afterEach(async () => {
  cleanup()
  // Dexie puede completar una suscripción de useLiveQuery en el siguiente
  // turno. Esperarlo evita que el beforeEach siguiente cierre la base antes
  // de que React termine de desmontar el componente anterior.
  await new Promise<void>((resolver) => setTimeout(resolver, 20))
})
