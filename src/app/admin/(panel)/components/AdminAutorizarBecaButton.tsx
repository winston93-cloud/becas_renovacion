'use client';

import { Button } from '@/components/ui';

type Props = {
  autorizada: boolean;
  verificado: boolean;
  saving: boolean;
  onClick: () => void;
};

export function AdminAutorizarBecaButton({
  autorizada,
  verificado,
  saving,
  onClick,
}: Props) {
  const disabled = saving || (!autorizada && !verificado);

  return (
    <Button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={
        !autorizada && !verificado
          ? 'Marque el expediente como verificado antes de autorizar la beca'
          : undefined
      }
      className={[
        'w-full sm:w-auto',
        '!min-h-[52px] px-8 py-3.5 text-base font-bold',
        autorizada
          ? '!border-transparent !bg-primary !text-white hover:!bg-primary-hover'
          : '!border-transparent !bg-red-600 !text-white hover:!bg-red-700',
      ].join(' ')}
    >
      {autorizada ? 'Quitar autorización' : 'Autorizar beca'}
    </Button>
  );
}
