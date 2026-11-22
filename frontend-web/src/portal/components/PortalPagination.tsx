type Props = {
  page: number;
  pageSize: number;
  count: number;
  onPage: (page: number) => void;
};

export default function PortalPagination({ page, pageSize, count, onPage }: Props) {
  if (count <= pageSize) return null;
  const paginas = Math.max(Math.ceil(count / pageSize), 1);
  const inicio = (page - 1) * pageSize + 1;
  const fin = Math.min(page * pageSize, count);

  return (
    <div className="portal-pagination">
      <span>{inicio}–{fin} de {count}</span>
      <div>
        <button
          type="button"
          className="portal-button-secondary"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
        >
          Anterior
        </button>
        <span>Página {page} de {paginas}</span>
        <button
          type="button"
          className="portal-button-secondary"
          onClick={() => onPage(page + 1)}
          disabled={page >= paginas}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
