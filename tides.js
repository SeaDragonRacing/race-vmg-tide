/*
  Race VMG tide logic

  Data source:
  LINZ daily tide predictions for Auckland, CSV format.
  Download each year's file from:
  linz.govt.nz > Tides and tidal streams > Tide predictions > Auckland

  Save them in the repository as:
    tides/auckland-2026.csv
    tides/auckland-2027.csv
    etc.

  LINZ times are already NZ local time
  (standard or daylight time as applicable).
*/

const TIDE_FILES = [
  "tides/auckland-2026.csv",
  "tides/auckland-2027.csv"
];

/* Minutes either side of high water that count as "Changing tide" */
const CHANGING_WINDOW_MINUTES = 30;


/*
  Turns LINZ CSV text into a sorted list of tide events:
  { time: Date, height: number, type: "high" | "low" }
*/
function parseLinzTideCsv(text) {
  const events = [];

  const lines = text.split(/\r\n|\r|\n/);

  lines.forEach(function(line) {
    const parts = line.split(",").map(function(part) {
      return part.trim();
    });

    /* Data rows look like: 12,Th,11,2026,05:47,3.1,11:51,0.9,... */
    if (
      parts.length < 6 ||
      !/^\d{1,2}$/.test(parts[0]) ||
      !/^\d{1,2}$/.test(parts[2]) ||
      !/^\d{4}$/.test(parts[3])
    ) {
      return;
    }

    const day = Number(parts[0]);
    const month = Number(parts[2]);
    const year = Number(parts[3]);

    for (let i = 4; i + 1 < parts.length; i += 2) {
      const timeText = parts[i];
      const heightText = parts[i + 1];

      const match = /^(\d{1,2})[:.](\d{2})$/.exec(timeText);

      if (!match || heightText === "") {
        continue;
      }

      const height = Number(heightText);

      if (Number.isNaN(height)) {
        continue;
      }

      events.push({
        time: new Date(
          year,
          month - 1,
          day,
          Number(match[1]),
          Number(match[2])
        ),
        height: height,
        type: null
      });
    }
  });

  return events;
}


/*
  Sorts events, removes duplicates and labels each
  event as high or low water by comparing heights
  with its neighbours.
*/
function prepareTideEvents(events) {
  events.sort(function(a, b) {
    return a.time - b.time;
  });

  const unique = events.filter(function(event, index) {
    return (
      index === 0 ||
      event.time.getTime() !== events[index - 1].time.getTime()
    );
  });

  unique.forEach(function(event, index) {
    const neighbour =
      index + 1 < unique.length
        ? unique[index + 1]
        : unique[index - 1];

    if (!neighbour) {
      event.type = null;
      return;
    }

    event.type =
      event.height > neighbour.height
        ? "high"
        : "low";
  });

  return unique;
}


/*
  Works out the tide state at a given time.

  Returns:
  {
    state: "incoming" | "outgoing" | "changing" | "unknown",
    label: text for display,
    image: "incoming" | "outgoing" | null,
    previous: event or null,
    next: event or null
  }
*/
function getTideStatus(events, now) {
  let previous = null;
  let next = null;

  for (let i = 0; i < events.length; i++) {
    if (events[i].time <= now) {
      previous = events[i];
    } else {
      next = events[i];
      break;
    }
  }

  if (!previous || !next || !previous.type || !next.type) {
    return {
      state: "unknown",
      label: "No tide data for this date",
      image: null,
      previous: previous,
      next: next
    };
  }

  const windowMs = CHANGING_WINDOW_MINUTES * 60 * 1000;

  /* Within the window before high water */
  if (
    next.type === "high" &&
    next.time - now <= windowMs
  ) {
    return {
      state: "changing",
      label: "Changing tide",
      image: "incoming",
      previous: previous,
      next: next
    };
  }

  /* Within the window after high water */
  if (
    previous.type === "high" &&
    now - previous.time <= windowMs
  ) {
    return {
      state: "changing",
      label: "Changing tide",
      image: "outgoing",
      previous: previous,
      next: next
    };
  }

  if (next.type === "high") {
    return {
      state: "incoming",
      label: "Incoming tide",
      image: "incoming",
      previous: previous,
      next: next
    };
  }

  return {
    state: "outgoing",
    label: "Outgoing tide",
    image: "outgoing",
    previous: previous,
    next: next
  };
}


/* Loads all available yearly files. Missing files are skipped. */
function loadTideEvents() {
  return Promise.all(
    TIDE_FILES.map(function(file) {
      return fetch(file)
        .then(function(response) {
          if (!response.ok) {
            return "";
          }

          return response.text();
        })
        .catch(function() {
          return "";
        });
    })
  ).then(function(texts) {
    let events = [];

    texts.forEach(function(text) {
      events = events.concat(parseLinzTideCsv(text));
    });

    return prepareTideEvents(events);
  });
}


/* Allows the logic to be tested outside the browser */
if (typeof module !== "undefined") {
  module.exports = {
    parseLinzTideCsv: parseLinzTideCsv,
    prepareTideEvents: prepareTideEvents,
    getTideStatus: getTideStatus
  };
}
