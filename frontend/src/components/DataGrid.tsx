import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

type Props<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  height?: number;
};

export function DataGrid<T>({ data, columns, height = 360 }: Props<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel()
  });
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 12
  });

  return (
    <div className="overflow-hidden rounded-card border border-hairline bg-surface">
      <div className="overflow-x-auto scrollbar">
        <div className="min-w-[760px]">
          <div className="sticky top-0 z-10 grid border-b border-hairline bg-raised">
            {table.getHeaderGroups().map((headerGroup) => (
              <div className="flex" key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <div
                    className="min-w-0 flex-1 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-secondaryText"
                    key={header.id}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div ref={parentRef} className="scrollbar overflow-auto" style={{ height }}>
            <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <div
                    className="absolute left-0 flex w-full border-b border-hairline/80 text-sm text-primaryText"
                    data-index={virtualRow.index}
                    key={row.id}
                    ref={virtualizer.measureElement}
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div className="min-w-0 flex-1 px-3 py-2" key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

