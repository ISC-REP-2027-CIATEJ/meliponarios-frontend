import { KaabMapBrand } from './ClientNavigation';
import './AuthLayout.css';

export default function AuthLayout({ photo, children }) {
  const backdrop = photo ? {
    backgroundImage: 'linear-gradient(150deg, #023b28be, #023b28f2), url(' + JSON.stringify(photo) + ')',
  } : undefined;
  return <main className="km-auth">
    <aside className="km-auth-brand" style={backdrop}>
      <KaabMapBrand link={false}/>
      <div className="km-auth-brand-info">
        <p>Meliponarios de Yucatán</p>
        <span>CIATEJ · Sede Sureste</span>
      </div>
    </aside>
    <section className="km-auth-main" aria-labelledby="access-title">{children}</section>
  </main>;
}
