'use client'

type Props = { initial: number; interval: number; readOnly?: boolean }

export function WindFrequencyFields({
  initial,
  interval,
  readOnly = false,
}: Props) {
  return (
    <>
      <label>
        Primeira ventania após (blocos)
        <input
          name="windMinBlocks"
          type="number"
          min="1"
          max="1000000"
          step="1"
          defaultValue={initial}
          readOnly={readOnly}
          required
        />
      </label>
      <label>
        Depois, a cada (blocos)
        <input
          name="windEveryBlocks"
          type="number"
          min="1"
          max="1000000"
          step="1"
          defaultValue={interval}
          readOnly={readOnly}
          required
        />
      </label>
    </>
  )
}
