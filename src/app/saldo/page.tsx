import type { Metadata } from 'next'
import { PantallaSaldo } from '@/ui/saldo/PantallaSaldo'

export const metadata: Metadata = {
  title: 'Tu cuenta · Libreta',
  description: 'Tu saldo y tus movimientos en el almacén.',
  robots: { index: false, follow: false },
}

export default function Saldo() {
  return <PantallaSaldo />
}
