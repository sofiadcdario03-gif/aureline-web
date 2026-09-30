import { Link } from 'react-router-dom';

export default function Brand({ light = false, to = '/' }) {
  return (
    <Link className={`brand ${light ? 'light' : ''}`} to={to} aria-label="Aureline Hotel home">
      <div className="brand-mark">
        A<span>✦</span>
      </div>
      <div>
        AURELINE<span>H O T E L</span>
      </div>
    </Link>
  );
}
