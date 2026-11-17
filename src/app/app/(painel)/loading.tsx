export default function Carregando() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="Carregando">
      <div className="flex flex-col gap-2">
        <div className="esqueleto h-3 w-28 !rounded" />
        <div className="esqueleto h-8 w-3/5 !rounded-md" />
      </div>
      <div className="esqueleto h-[104px]" />
      <div className="esqueleto h-[54px]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="esqueleto aspect-[4/5] !rounded-[14px]" />
        ))}
      </div>
    </div>
  );
}
