# Dashboard

Management panel for building and deploying BAID's website.

## Get Started

To run in production:

* Using `pm2` allows for proper deployment in production.

To run in development:

* Ensure that you have node.js and npm available.
* Run `npm install`.
* Copy `.env.example` to `.env` and fill the following environment variables:

| Name                | Description                                                                    |
|---------------------|--------------------------------------------------------------------------------|
| `DATABASE_URL`      | The database URL to use. Typically `sqlite:///database.db`.                    |
| `HOSTED`            | The location where dashboard is hosted. No trailing slashes.                   |
| `WAGTAIL_URL`       | The URL to Wagtail admin.                                                      |
| `WAGTAIL_AUTH_PATH` | The path to Wagtail admin to request for authentication.                       |
| `PREVIEW_URL`       | The URL to the preview server.                                                 |
| `PROD_URL`          | The URL to the production server.                                              |
| `DEPLOY_MODE`       | `cloudflare` or `local`.                                                       |
| `DEPLOY_PASSWORD`   | The password used to deploy the website.                                       |
| `PREVIEW_PATH`      | Only for `local` mode. The path to the preview server. No trailing slashes.    |
| `PROD_PATH`         | Only for `local` mode. The path to the production server. No trailing slashes. |
| `PREVIEW_PROJECT`   | Only for `cloudflare` mode. The name of the Pages project for preview.         |
| `PROD_PROJECT`      | Only for `cloudflare` mode. The name of the Pages project for production.      |
| `CF_ACCOUNT_ID`     | Only for `cloudflare` mode. The Cloudflare account ID.                         |
| `CF_API_TOKEN`      | Only for `cloudflare` mode. The Cloudflare API token.                          |
| `WEBSITE_REPO`      | The URL of the website repository.                                             |
| `PROXY`             | Proxy, if required to connect to internet.                                     |

* Run `npm run dev`.

## Contribution

Contribution is accepted from Beijing Academy students. All contributions are owned by Beijing Academy.

## License

All rights reserved unless otherwise stated.

"Beijing Academy," "BAID," "Better Me, Better World," and the Beijing Academy logo are legally protected and may not be
used without official authorization.
