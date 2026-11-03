import { FormRecuperar } from "../form";
import { MarcoAcceso } from "../marco";

export const metadata = { title: "Recuperar contraseña · Colombia Automotores" };

export default function RecuperarPage() {
  return (
    <MarcoAcceso titulo="Recuperar contraseña" bajada="Te mandamos un link a tu mail para elegir una nueva.">
      <FormRecuperar />
    </MarcoAcceso>
  );
}
