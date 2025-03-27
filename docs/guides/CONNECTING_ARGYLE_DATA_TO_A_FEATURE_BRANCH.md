# Connecting Argyle data to a feature branch

Sometimes, we may want to configure [Argyle webhooks](https://docs.argyle.com/console/management/webhooks) to work with a feature
branch, e.g., if we want to test data syncing or related functionalities.

**This guide explains how to configure Supabase and Argyle webhooks on a feature branch.**

**Note: These steps have already been configured on the `staging` branch. In most cases, just using the staging branch as a testing environment should be sufficient.**

Using the staging branch means that you don't have to repeat these steps.
The staging branch points to the Argyle sandbox API: `https://api-sandbox.argyle.com`.

See the Argyle article about [Sandbox Testing](https://docs.argyle.com/overview/sandbox-testing) for information about the available accounts.

**Only** the `test1@argyle.com`, `test2@argyle.com`, and `test3@argyle.com` accounts work with the Argyle sandbox API. **Other accounts will not work.**

## What is Argyle and how do we use it?

Argyle is the data source for System. Gig data and account information flows from Argyle to System. Drivers authenticate their gig accounts through Argyle, which then sends its data to System.

This data is sent using webhooks, which are handled by the System server.

[See Argyle's Docs](https://docs.argyle.com/) for more information.

## What is Supabase and how do we use it?

Supabase is the database and authentication platform for System. We have
a staging and production instance set up for Supabase. For testing on a feature
branch, we'll need to create another Supabase instance and link it to the
feature branch deployment.

## What is Netlify and how do we use it?

Netlify is the hosting platform that System uses. The System code is deployed on Netlify.

## How to configure Argyle webhooks, Supabase, and Netlify on a feature branch

### Supabase

1. On Supabase, go to the production instance, and click on `main`
   (this represents the `main` branch, which is where the production Supabase
   deployment points). Click the dropdown option **Manage branches**.
2. Click **Create branch** and enter the feature branch name.
3. Choose **Project settings** from the bottom-left menu (the gear icon)
4. Choose **API** in the sidebar

### Netlify

For this branch **only**:

1. Set the `PUB_VITE_SUPABASE_URL` value to the URL shown on the Supabase
   API settings.
2. Set the `SUPABASE_SERVICE_KEY` value to the `service_role [secret]`
   value shown on the Supabase API settings.
3. Set the `PUB_VITE_SUPABASE_ANON_KEY` value to the `anon [public]`
   value shown on the Supabase API settings.

### Argyle

1. Visit the [Argyle console](https://console.argyle.com/)
2. Toggle "Sandbox mode" as desired in the top right of the screen.
3. Click **Developers** on the top right, then choose **Webhooks** from
   the left bar.
4. Choose **+ New webhook**
5. Set the following values:
   - Name: the name of your feature branch
   - URL: `https://deploy-preview-###--system.netlify.app/api/driver/argyle/webhooks` (where ### is replaced by your PR number)
   - Secret: (blank)
   - API v2
   - All events

---

Upon completing these steps, Argyle, Netlify, and Supabase should all
be working on your feature branch. Note that the easier option is to use
the pre-configured `staging` branch.
