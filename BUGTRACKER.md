## Bugs

- brave doesn't work with shield on - notify player
- `StorageType.persistent is deprecated. Please use standardized navigator.storage instead.` in Chrome
- console log `{"xkKZ4": "g"}` on page load
- When reloading `[localState] EventSource failed` - `The connection to https://devmap.lenn.uk/api/campaigns/not-curse-of-strahd/events was interrupted while the page was loading.`
- DM can't teleport player to tile that's not visible
- 1 week = 10 days, not 7 days
  - game time should be displayed as Xth flamerule
- scroll zoom and pan are not performant
- scroll pan is too slow
- path starts from second position
- SSE unstable - players movement and session start sometimes not updating without restart
  - `events/` connection closes on MacOS Chrome, pings end (logs in next header)

## Feature Requests

- update sidebar - PoI exist now
- drawing tools
- note tools?
- track expedition
  - players can start
  - if session starts and expedition active, add session under expedition
  - else add to "downtime"
  - one path per session
  - track people on expedition
    - track consumables
- random encounter counter for DM (nagu wild magic)
- mängijad ei näe revealed tile kordinaate
- scroll zoom centered on cursor position
- pan should be right click + drag
- allow moving map tokens

## Error logs

### Chrome Console

```js
main.js:1
  {xkKZ4: 'g'}
    xkKZ4: "g"
    [[Prototype]]: Object
  2.BVR2xw-A.js:1

[localState] EventSource failed:
  Event {isTrusted: true, type: 'error', target: EventSource, currentTarget: EventSource, eventPhase: 2, …}
    isTrusted: true
    bubbles: false
    cancelBubble: false
    cancelable: false
    composed: false
    currentTarget: EventSource {
      url: 'https://devmap.lenn.uk/api/campaigns/not-curse-of-strahd/events', withCredentials: false, readyState: 2, onopen: null, onmessage: ƒ, …}
      defaultPrevented: false
      eventPhase: 0
      returnValue: true
      srcElement: EventSource {
        url: 'https://devmap.lenn.uk/api/campaigns/not-curse-of-strahd/events', withCredentials: false, readyState: 2, onopen: null, onmessage: ƒ, …}
        target: EventSource {
          url: 'https://devmap.lenn.uk/api/campaigns/not-curse-of-strahd/events', withCredentials: false, readyState: 2, onopen: null, onmessage: ƒ, …}
          timeStamp: 43858.59999999963
          type: "error"
          [[Prototype]]: Event
  eventSource.onerror @ 2.BVR2xw-A.js:1

api/campaigns/not-curse-of-strahd/events:1
  GET https://devmap.lenn.uk/api/campaigns/not-curse-of-strahd/events
  net::ERR_CONNECTION_RESET 200 (OK)
```

### Server Logs

```sh
chult-web | 2025-12-13T13:38:32.853837807Z (node:1) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 campaign-not-curse-of-strahd listeners added to [EventEmitter]. MaxListeners is 10. Use emitter.setMaxListeners() to increase limit
```
