# cornerGuider Web-Demo

Eine GPX-Datei laden und die Kurven der Strecke ansehen, wie sie die App sieht: Kurvenliste mit Stufe, Radius und Winkel, Fahrmodus-Vorschau mit Kurvengrafik und Fahrlinie, Streckenverlauf und eine Abspielfunktion.

**Alles läuft im Browser.** Es gibt keinen Server und es werden keine Daten hochgeladen. Die Demo nutzt dieselbe Kernlogik wie die App (`../src`: GPX-Parser, Kurvenerkennung, Kurvengrafik), deshalb stimmen Ergebnisse und Darstellung überein.

## Entwickeln

```bash
cd web-demo
npm install
npm run dev        # http://localhost:5173
npm run build      # statische Dateien in dist/
npm run preview    # gebauten Stand ansehen
```

## Auf der Website einbinden

`dist/` ist statisch (relative Pfade) und kann in jedes Unterverzeichnis kopiert oder per `<iframe>` eingebunden werden. `?sample` lädt die Beispielstrecke gleich (Passo dello Stelvio, MIT-Lizenz, aus `gpx-rider`), `?sample&pos=3520` setzt zusätzlich die Position in Metern.

```html
<iframe src="/demo/?sample" title="cornerGuider Web-Demo" style="width:100%;height:1100px;border:0"></iframe>
```

## Hinweise

- Die Kurven werden wie in der App aus der GPX-Datei berechnet. Dünn gepunktete Routen (nur Wegpunkte) liefern ungenaue Kurven, die Demo zeigt dann eine Warnung.
- Keine Geschwindigkeitsempfehlung; die Fahrlinie ist ein rein geometrischer Vorschlag in der eigenen Spur.
- Die Freie Fahrt (OpenStreetMap) ist nicht Teil der Web-Demo.
