# Deploy

Mission Control runs on two hosts. Vercel serves the Next.js app. Convex Cloud runs the backend: database, functions, crons, and auth. One Vercel build deploys both.

## Terms

| Term | Meaning |
|---|---|
| Dev deployment | The Convex deployment that `npx convex dev` uses. |
| Prod deployment | The Convex production deployment of the project. Real users and their data live here. |
| Deploy key | A Convex production deploy key. Vercel uses it to push functions to the prod deployment. |
| Site URL | The public origin of the web app, for example `https://mission-control.vercel.app`. Use `https` and no trailing slash. |

## How a deploy works

On each push to `main`, Vercel runs `npx convex deploy --cmd 'npm run build'`. The command does these steps in order:

1. It reads `CONVEX_DEPLOY_KEY` and finds the prod deployment.
2. It runs `npm run build` with `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` set to the prod URLs.
3. It typechecks, bundles, and pushes the Convex functions, schema, indexes, and crons.

If one step fails, the next steps do not run, and Vercel does not publish the build.

Vercel holds one secret: the deploy key. All other secrets live in the prod deployment. Convex applies a change to its environment at once, with no redeploy.

## Before you start

- Commit and push all work to `main`. Vercel builds from GitHub, not from your disk.
- Have a Vercel account linked to GitHub, and the Convex project that `npx convex dev` created.
- Have the keys for live mode: OpenRouter and Tavily. Composio, Jina, GitHub OAuth, and Google OAuth are optional.

## 1. Create the deploy key

1. Open the Convex dashboard and select the project.
2. Select the **Production** deployment. Create it if the dashboard asks.
3. Open **Settings → General** and click **Generate Production Deploy Key**.
4. If the dashboard asks for permissions, give the key `deployment:deploy`.
5. Copy the key.

## 2. Create the Vercel project

1. In Vercel, click **Add New → Project** and import `EAGLE1309/agentic-mission-control`.
2. Keep the framework preset **Next.js** and the root directory `./`.
3. Override the **Build Command** with `npx convex deploy --cmd 'npm run build'`.
4. Add the environment variable `CONVEX_DEPLOY_KEY` with the key from step 1. Select only the **Production** environment.
5. Click **Deploy**.
6. Copy the production domain from the project page. This is the site URL.

The build succeeds, but sign-in fails until you do step 3.

**Preview builds.** The deploy key is for Production only, so a build of another branch or a pull request fails at `npx convex deploy`. Previews also cannot sign in, because auth trusts only the site URL. To stop these builds, open **Settings → Git → Ignored Build Step** and select **Only build production**.

## 3. Set the prod environment

Run these commands from the repo root. The `--prod` flag selects the prod deployment through `CONVEX_DEPLOYMENT` in `.env.local`.

1. Make a new auth secret. Do not reuse the dev secret.

   ```sh
   openssl rand -base64 32
   ```

2. Set the required values.

   ```sh
   npx convex env set BETTER_AUTH_SECRET "<secret>" --prod
   npx convex env set SITE_URL "https://<your-domain>" --prod
   ```

3. Set the keys for live mode.

   ```sh
   npx convex env set OPENROUTER_API_KEY "<key>" --prod
   npx convex env set TAVILY_API_KEY "<key>" --prod
   ```

4. Set the optional keys that you use: `COMPOSIO_API_KEY`, `JINA_API_KEY`, and the OAuth keys from step 4.
5. Check the result: `npx convex env list --prod`.

To keep a secret out of your shell history, omit the value and pipe it in. In PowerShell: `Get-Clipboard | npx convex env set OPENROUTER_API_KEY --prod`.

| Name | Prod value |
|---|---|
| `BETTER_AUTH_SECRET` | A new random value. Sessions sign with it. |
| `SITE_URL` | The site URL, exact. Auth accepts requests only from this origin. Composio returns users to `{SITE_URL}/integrations`. |
| `OPENROUTER_API_KEY` | Required for live missions. Without it, prod runs simulated missions. |
| `TAVILY_API_KEY` | Required for `web_search`. Without it, agents use `fetch_url` only. |
| `COMPOSIO_API_KEY` | Optional. Turns on third-party apps on the Integrations page. |
| `JINA_API_KEY` | Optional. Raises the Jina Reader limits. |
| `MISSION_QUOTA` | Do not set. The default of 3 missions for each user each day protects the free keys. `off` is for dev only. |
| `LLM_MODE` | Do not set. Prod runs live when the OpenRouter key is set. |
| `OPENROUTER_DAILY_CAP`, `TAVILY_DAILY_CAP` | See [Shared keys](#shared-keys). |

The [README](../README.md#environment) lists all names, including the model chain overrides.

### Shared keys

Each deployment counts its own daily calls. The provider counts the total of all deployments that use a key. If dev and prod share one OpenRouter or Tavily key, the two counters together can go over the provider limit.

Do one of these:

- Use a different key on each deployment.
- Split the cap. For example, with the Tavily default of 30 each day, set `TAVILY_DAILY_CAP=20` on prod and `TAVILY_DAILY_CAP=10` on dev.

## 4. Add OAuth sign-in (optional)

Email and password sign-in needs no more setup. A provider button shows only when both of its keys are set.

**GitHub.** A GitHub OAuth app has one callback URL, so make a second OAuth app for prod.

1. Open **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Set **Homepage URL** to the site URL.
3. Set **Authorization callback URL** to `{SITE_URL}/api/auth/callback/github`.
4. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` on prod.

**Google.** One OAuth client can hold the dev and prod URLs.

1. Open the OAuth client in Google Cloud Console.
2. Add `{SITE_URL}` to **Authorized JavaScript origins**.
3. Add `{SITE_URL}/api/auth/callback/google` to **Authorized redirect URIs**.
4. Publish the app on the OAuth consent screen (**Audience**). In **Testing** status, only the listed test users can sign in.
5. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on prod.

## 5. Do the first-run tasks

1. Fill the model catalog: `npx convex run catalog:refresh --prod`. The daily cron also fills it, but its first run can be up to 24 hours later. With an empty catalog, agents use the preset chains without the catalog check.
2. Create the accounts you need, for example a demo login, on `{SITE_URL}/sign-up`. Dev users, missions, and app connections do not move to prod.

## 6. Verify

1. Open the site URL. The landing demo plays.
2. Sign up with email and password. The app opens `/home`.
3. Open **Integrations**. OpenRouter shows **Connected**. **Not set up** means the prod deployment has no OpenRouter key. **Simulated** means `LLM_MODE` is set to `simulated`.
4. Start a mission. The graph and the stream update live, and the mission ends with a report.
5. If you set `COMPOSIO_API_KEY`, connect an app. The browser returns to `/integrations`, and the app shows as connected.
6. In the Convex dashboard, open the prod deployment. **Logs** shows no errors. **Schedules** shows the two cron jobs.

## Troubleshoot

| Symptom | Cause | Fix |
|---|---|---|
| The Vercel build fails at `npx convex deploy` and asks for a deployment. | The build has no deploy key. This is usually a preview build. | Set the key for Production, or ignore preview builds (step 2). |
| The Vercel build fails at the Convex typecheck or push. | A type error in `convex/`, or a schema that does not match the prod data. | Read the error in the Vercel build log. Fix it on your machine with `npx convex dev --once`, then push again. |
| Sign-in fails with an origin error. | `SITE_URL` does not match the origin in the browser. | Set `SITE_URL` to the exact origin: `https`, no trailing slash, the domain that users open. |
| Sign-in fails, and the prod logs mention `BETTER_AUTH_SECRET`. | The secret is not set on prod. | Set it (step 3). |
| OAuth shows `redirect_uri` mismatch. | The provider does not have the prod callback URL. | Add the callback URL (step 4). |
| The GitHub or Google button does not show. | One of the two keys is not set on prod. | Set both keys. |
| Missions run with scripted agents. | Prod has no `OPENROUTER_API_KEY`. | Set the key. |
| A user cannot start a mission. | The user used 3 missions today. The limit resets at 00:00 UTC. | This is the expected limit. Raise `MISSION_QUOTA` only with a paid key. |
| `web_search` rows show red. | The Tavily daily cap is used up. | Wait for 00:00 UTC, or raise `TAVILY_DAILY_CAP` on a paid plan. |

## Add a custom domain

1. In Vercel, open **Settings → Domains** and add the domain.
2. Set `SITE_URL` on prod to the new origin.
3. Update the GitHub and Google callback URLs.

You do not need to rebuild. The web app does not build the site URL into its code.

## Roll back

- **Web app only.** In Vercel, open **Deployments**, select an earlier production deployment, and click **Instant Rollback**. The Convex functions stay at the latest push.
- **Web app and backend.** Revert the commit on `main` and push. Vercel builds again and pushes the earlier functions.

Convex refuses a push when a schema does not match the data in prod. If a rollback removes a table or a field, delete or migrate that data first.
