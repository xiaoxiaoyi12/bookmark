import type { NavItem } from 'epubjs'

interface Props {
  items: NavItem[]
  onSelect: (href: string) => void
}

export default function TableOfContents({ items, onSelect }: Props) {
  const renderItems = (navItems: NavItem[], depth = 0) => (
    <ul>
      {navItems.map((item, i) => (
        <li key={i}>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded truncate"
            style={{ paddingLeft: `${12 + depth * 16}px` }}
            onClick={() => onSelect(item.href)}
          >
            {item.label.trim()}
          </button>
          {item.subitems && item.subitems.length > 0 && renderItems(item.subitems, depth + 1)}
        </li>
      ))}
    </ul>
  )

  return (
    <nav className="h-full overflow-y-auto py-2">
      <h2 className="px-3 py-2 text-xs font-semibold text-amber-600/50 dark:text-gray-500 uppercase">目录</h2>
      {renderItems(items)}
    </nav>
  )
}
