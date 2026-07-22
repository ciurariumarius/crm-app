# LMS recurring work cron

One protected cron call processes every active rule configured in **LMS Analysis → Data → Recurring Work**. Generated rows are normal Work Entries, begin as `Not exported`, and use the standard CRM export flow.

Rules belong directly to this single-owner application. Work Entries are global application data, so recurrence configuration has no tenant or user selector.

## Application environment

Keep this value in the production application environment:

```dotenv
CRON_SECRET=<strong-random-secret>
```

## CloudPanel cron job

Configure the CloudPanel job for `08:05` in `Europe/Bucharest` and call:

```bash
/usr/bin/curl --fail --silent --show-error --request POST --header "Authorization: Bearer <CRON_SECRET>" https://crm.populatia.ro/api/cron/lms-daily-admin-work
```

Crontab equivalent when the server supports per-job timezones:

```cron
CRON_TZ=Europe/Bucharest
5 8 * * * /usr/bin/curl --fail --silent --show-error --request POST --header "Authorization: Bearer <CRON_SECRET>" https://crm.populatia.ro/api/cron/lms-daily-admin-work
```

The endpoint URL remains unchanged from the original administrative-task automation. Use the same secret as the application environment and never commit its real value.

Before enabling the scheduled job, verify all rules and predicted counters without writing data:

```bash
/usr/bin/curl --fail --silent --show-error --request POST --header "Authorization: Bearer <CRON_SECRET>" "https://crm.populatia.ro/api/cron/lms-daily-admin-work?dryRun=1"
```

The runner calculates dates in `Europe/Bucharest`, excludes Romanian legal holidays, catches up unprocessed dates after outages, and safely handles repeated calls. Rules are processed independently. If any active rule has a detached client or inactive task, valid rules still commit but the endpoint returns a failing HTTP status so `curl --fail` reports the partial failure.
