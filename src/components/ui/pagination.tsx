import { Button } from '@/components/ui/button';

export function PaginationBar({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  disabled,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (total <= 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
      <p className="text-xs text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs font-semibold text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
