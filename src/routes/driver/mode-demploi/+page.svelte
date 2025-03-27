<script lang="ts">
  import { locale } from 'svelte-i18n';
  import { title } from '@src/lib/stores/pageinfo';

  import BreadCrumb from '@src/lib/components/BreadCrumb.svelte';

  title.set('Mode d’emploi');
  locale.set('fr');
</script>

<BreadCrumb returnUrl="/driver/landing" text="← Retour à la page d'inscription" />
<div class="prose">
  <h1>Instructions pour l'inscription</h1>

  <p>
    Bonjour les conducteurs! Le PELQ s'associe à des chercheurs de University et du University pour
    étudier les taux de participation équitables et l'équité des courses en taxi.
    <strong>
      L'inscription prend 5 minutes et vous obtiendrez des informations sur le taux de participation
      réel.
    </strong>
  </p>
  <p class="text-center">
    <a href="/driver/org" class="btn btn-neutral"> Participer à l’étude </a>
  </p>
  <p>
    Pour obtenir des instructions détaillées sur l'inscription, suivez les trois étapes ci-dessous.
  </p>
  <h2>Étape 1: Participer à l’étude</h2>
  <ul>
    <li>
      Ouvrir <a href="https://getsystem.org/driver">getsystem.org/driver</a>
      sur votre téléphone
    </li>
    <li>Pour commencer, cliquer «<strong>Rejoignez notre étude</strong>»</li>
  </ul>
  <div class="max-w-[250px] m-auto">
    <img
      src="/img/instructions/how-much-is-uber-taking.jpg"
      class="border border-black"
      alt="A screenshot of the System interface with a red arrow pointing at the 'Join Our Study' button."
    />
  </div>
  <ul>
    <li>
      Vous pouvez également sélectionner une organisation affiliée et cliquer sur «<strong
        >Continuer</strong
      >»
    </li>
    <li>
      Vous pouvez également choisir de partager vos données avec votre organisation affiliée et
      cliquer sur «<strong>Lier mon compte Uber/Lyft</strong>» pour lier votre ou vos comptes
    </li>
    <li>
      Le site vous transférera vers Argyle afin de partager l’historique de vos trajets pour Uber
      avec l’équipe de recherche
    </li>
  </ul>
  <h2>Étape 2: Partager vos courses</h2>
  <ul>
    <li>
      Se connecter en sélectionnant numéro de mobile ou email - utiliser votre mobile est souvent
      plus facile
    </li>
    <li>
      Saisir votre numéro de téléphone ou adresse électronique pour recevoir un code de
      vérification; saisir le code de vérification
    </li>
  </ul>
  <div class="max-w-[250px] m-auto">
    <img
      src="/img/instructions/how-do-you-want-to-log-in.jpg"
      class="border border-black"
      alt="A screenshot of the data linking screen, with a red arrow pointing at the 'Phone Number' button."
    />
  </div>
  <ul>
    <li>
      Vérifiez votre identité. Vous pouvez recevoir des SMS, des e-mails ou des notifications
      d'Uber/Lyft.
    </li>
    <li>
      Cliquez sur «<strong>Continuer avec System</strong>» ou «<strong
        >Associer d'autres comptes</strong
      >»
    </li>
  </ul>
  <div class="max-w-[250px] m-auto">
    <img
      src="/img/instructions/your-uber-account-is-connected.png"
      class="border border-black"
      alt="A screenshot with text 'Your Uber account is connected' with a red arrow pointing at a 'Continue to System button'."
    />
  </div>
  <ul>
    <li>
      Vous recevrez peut-être un SMS du 855-542-0614 dans quelques minutes ou quelques heures. Vous
      pouvez fermer System. 🙂
    </li>
  </ul>
  <p class="text-center my-4">
    <a href="/driver/org" class="btn btn-neutral"> Participer à l’étude </a>
  </p>

  <p>
    Si vous avez des questions, problèmes, ou suggestions, nous serons ravis de vous aider -
    envoyez-nous un mail à l’adresse suivante
    <a href="mailto:theorganization@university.edu">theorganization@university.edu</a>.
  </p>
  <BreadCrumb returnUrl="/driver/landing" text="← Retour à la page d'inscription" />
</div>
