import React from 'react';
import { Search } from 'lucide-react';

export default function Empty({
  text = 'Nothing here just yet.',
  detail = 'Try changing your search or filters.',
}) {
  return (
    <div className="empty">
      <Search size={26} />
      <h3>{text}</h3>
      <p>{detail}</p>
    </div>
  );
}
