import { useContext } from 'react';

import ConfirmContext from './ConfirmContext';

export default function useConfirm() {
  const confirmar = useContext(ConfirmContext);
  if (!confirmar) {
    throw new Error('useConfirm debe usarse dentro de ConfirmProvider.');
  }
  return confirmar;
}
