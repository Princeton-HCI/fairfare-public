<script lang="ts">
  import { locale } from 'svelte-i18n';
  import { title } from '@src/lib/stores/pageinfo';

  import BreadCrumb from '@src/lib/components/BreadCrumb.svelte';
  import { PUB_SUPPORT_EMAIL } from '$env/static/public';

  title.set('Instrucciones');
  locale.set('es');
</script>

<BreadCrumb returnUrl="/driver/landing" text="← Volver a la página de inscripción" />
<div class="prose">
  <h1>Instrucciones de inscripción</h1>

  <p>
    ¡Hola conductores! PELQ se está asociando con investigadores de Sample University para estudiar
    las comisiones justas y la demanda de tus viajes.
    <strong>
      Registrarte tarda 5 minutos, y obtendrás información sobre los porcentajes de las comisiones
      reales.
    </strong>
  </p>
  <p class="text-center">
    <a href="/driver/org" class="btn btn-neutral"> Únete al estudio </a>
  </p>
  <p>Por instrucciones detalladas, sigue los pasos abajo.</p>
  <h2>Paso 1: Únete al estudio</h2>
  <ul>
    <li>
      Abre <a href="https://getsystem.org/driver/">getsystem.org/driver/</a>
      en tu celular
    </li>
    <li>Para comenzar, haz clic en “<strong>Únete a nuestro estudio</strong>”</li>
  </ul>
  <div class="max-w-[250px] m-auto">
    <img
      src="/img/instructions/how-much-is-uber-taking.webp"
      class="border border-black"
      alt="A screenshot of the System interface with a red arrow pointing at the 'Join Our Study' button."
    />
  </div>
  <ul>
    <li>
      Opcionalmente, selecciona una organización afiliada y haga clic en “<strong>Continuar</strong
      >”
    </li>
    <li>
      Opcionalmente, elije compartir sus datos con su organización afiliada y haga clic en “<strong
        >Vincular mi cuenta de Uber/Lyft</strong
      >” para vincular su cuenta o cuentas
    </li>
    <li>
      La aplicación te llevará a Argyle para que pueda agregar los datos de tu trabajo a nuestro
      estudio
    </li>
  </ul>
  <h2>Paso 2: Vincula tus datos</h2>
  <ul>
    <li>
      Inicia sesión seleccionando tu número de teléfono o tu correo (utilizar tu número de teléfono
      será más sencillo)
    </li>
    <li>Ingresa tu teléfono o correo para recibir el código de verificación</li>
  </ul>
  <div class="max-w-[250px] m-auto">
    <img
      src="/img/instructions/how-do-you-want-to-log-in.webp"
      class="border border-black"
      alt="A screenshot of the data linking screen, with a red arrow pointing at the 'Phone Number' button."
    />
  </div>
  <ul class="list-disc pl-8">
    <li>
      Verifique su identidad. Es posible que reciba mensajes de texto, correos electrónicos o
      notificaciones de Uber/Lyft.
    </li>
    <li>
      Haz clic en “<strong>Continuar con System</strong>” o “<strong>Vincular más cuentas</strong>”
    </li>
  </ul>
  <div class="max-w-[250px] m-auto">
    <img
      src="/img/instructions/your-uber-account-is-connected.webp"
      class="border border-black"
      alt="A screenshot with text 'Your Uber account is connected' with a red arrow pointing at a 'Continue to System button'."
    />
  </div>
  <ul>
    <li>
      Es posible que recibas un mensaje de texto del 855-542-0614 en unos minutos o unas horas.
      Puedes cerrar System. 🙂
    </li>
  </ul>

  <p class="text-center my-4">
    <a href="/driver/org" class="btn btn-neutral"> Únete al estudio </a>
  </p>

  <p>
    Si tienes alguna pregunta, problema o petición, nos encantaría ayudarte. Envíanos un correo a
    <a href="mailto:{PUB_SUPPORT_EMAIL}">{PUB_SUPPORT_EMAIL}</a>.
  </p>
  <BreadCrumb returnUrl="/driver/landing" text="← Volver a la página de inscripción" />
</div>
