# JSON Calendar

A small reference calendar plugin that imports appointments from a JSON file. It requests no network access and contains no external dependencies.

Choose a JSON file in the plugin panel and select **Import events**. A successful import replaces the previous events for that calendar. An empty array clears it. Invalid files leave the previous import intact.

## JSON format

Provide either an array or an object with an `events` array. Each event needs a unique string `id`, a `title`, and `start` and `end` timestamps with an explicit timezone offset. `allDay` is optional and defaults to `false`.

```json
[
  {
    "id": "appointment-1",
    "title": "Project planning",
    "start": "2026-11-02T09:00:00+01:00",
    "end": "2026-11-02T10:00:00+01:00",
    "allDay": false
  }
]
```

See [example.json](example.json) for a complete example. End times must be later than start times. The upload is limited to 1 MB and 1,000 events; imported data must fit within the host's 64 KiB state limit. The host stores that state with the calendar, so do not import data you do not want stored there.

## Development

Run `npm test` with Node.js 22.6 or newer. The manifest declares a calendar provider with a page panel; the implementation supplies the panel and returns imported events through the provider interface.
