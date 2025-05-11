# Dashboard

Management panel for building and deploying BAID's website.

## Get Started

To run in production:

* Using `pm2` allows for proper deployment in production.

To run in development:

* Ensure that you have node.js and npm available.
* Run `npm install`.
* Copy `.env.example` to `.env` and fill the following environment variables:

| Name              | Description                                                        |
|-------------------|--------------------------------------------------------------------|
| `DATABASE_URL`    | The database URL to use. Typically `sqlite:///database.db`.        |
| `HOSTED`          | The location where dashboard is hosted. No trailing slashes.       |
| `DEPLOY_PASSWORD` | The password used to deploy the website.                           |
| `WAGTAIL_PATH`    | The path to the Wagtail instance admin panel. No trailing slashes. |
| `PREVIEW_URL`     | The URL to the preview server.                                     |
| `PROD_URL`        | The URL to the production server.                                  |
| `PREVIEW_PATH`    | The path to the preview server. No trailing slashes.               |
| `PROD_PATH`       | The path to the production server. No trailing slashes.            |
| `WEBSITE_REPO`    | The URL of the website repository.                                 |

* Run `npm run dev`.

## Contribution

Contribution is accepted from Beijing Academy students. All contributions are owned by Beijing Academy.

## License

All rights reserved unless otherwise stated.

"Beijing Academy," "BAID," "Better Me, Better World," and the Beijing Academy logo are legally protected and may not be
used without official authorization.
