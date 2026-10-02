import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={title:'Rifa · Tropa Jiu Jitsu Dolores',description:'Rifa del gimnasio Tropa Team: televisor Noblex de 50 pulgadas o premio opcional de $500.000.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es-AR"><body>{children}</body></html>;}
