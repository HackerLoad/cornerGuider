import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { applyOrientation } from '../services/orientation';
import { speakWithSettings, voicesFor, type Voice } from '../services/speech';
import { currentDriveSettings, useSettingsStore } from '../stores/settingsStore';
import { exampleAnnouncement } from '../voice/phrases';
import { colors } from '../theme';
import { ButtonRow, ChoiceRow, Section, StepperRow, ToggleRow, clamp } from './SettingsRows';

const GRADE_NOTE: Record<number, string> = {
  1: 'Nur Spitzkehren',
  2: 'Spitzkehren und sehr enge Kurven',
  3: 'Enge Kurven',
  4: 'Mittlere und engere Kurven',
  5: 'Fast alle Kurven',
  6: 'Alle Kurven',
};

export function SettingsView() {
  const s = useSettingsStore();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [showVoices, setShowVoices] = useState(false);

  useEffect(() => {
    let cancelled = false;
    voicesFor(s.voiceLanguage).then((v) => !cancelled && setVoices(v));
    return () => {
      cancelled = true;
    };
  }, [s.voiceLanguage]);

  const voiceName = s.voiceId ? (voices.find((v) => v.identifier === s.voiceId)?.name ?? 'Gewählte Stimme') : 'Standardstimme';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Section title="Ansagen">
        <ToggleRow label="Sprachansagen" value={s.voiceEnabled} onChange={(v) => s.set({ voiceEnabled: v })} />
        <StepperRow
          label="Ansagen ab Stufe"
          note={`${GRADE_NOTE[s.minAnnounceGrade]}. Leichtere Kurven werden nur genannt, wenn sie direkt auf eine angesagte folgen.`}
          value={`Stufe ${s.minAnnounceGrade}`}
          onMinus={() => s.set({ minAnnounceGrade: clamp(s.minAnnounceGrade - 1, 1, 6) })}
          onPlus={() => s.set({ minAnnounceGrade: clamp(s.minAnnounceGrade + 1, 1, 6) })}
        />
        <ChoiceRow
          label="Stil"
          value={s.announceStyle}
          options={[{ value: 'long', label: 'Ausführlich' }, { value: 'short', label: 'Kurz' }]}
          note={s.announceStyle === 'long' ? 'Mit Entfernung: „In 240 Metern Rechts 3"' : 'Nur die Kurve: „Rechts 3"'}
          onChange={(v) => s.set({ announceStyle: v })}
        />
        {s.announceStyle === 'long' ? (
          <ToggleRow label="Form ansagen" note={'„zieht zu“ bzw. „öffnet“'} value={s.announceShape} onChange={(v) => s.set({ announceShape: v })} />
        ) : null}
        <StepperRow
          label="Vorwarnzeit"
          value={`${s.leadSeconds} s`}
          onMinus={() => s.set({ leadSeconds: clamp(s.leadSeconds - 1, 2, 15) })}
          onPlus={() => s.set({ leadSeconds: clamp(s.leadSeconds + 1, 2, 15) })}
        />
        <StepperRow
          label="Mindestabstand"
          value={s.units === 'metric' ? `${s.minLeadM} m` : `${Math.round(s.minLeadM * 3.281 / 10) * 10} ft`}
          onMinus={() => s.set({ minLeadM: clamp(s.minLeadM - 10, 40, 300) })}
          onPlus={() => s.set({ minLeadM: clamp(s.minLeadM + 10, 40, 300) })}
        />
      </Section>

      <Section title="Stimme" hint="Die Lautstärke der Ansagen richtet sich nach der Lautstärke des Geräts. Musik anderer Apps wird währenddessen leiser, nicht gestoppt.">
        <ChoiceRow
          label="Sprache der Ansagen"
          value={s.voiceLanguage}
          options={[{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }]}
          onChange={(v) => s.set({ voiceLanguage: v, voiceId: null })}
        />
        <StepperRow
          label="Sprechtempo"
          value={`${s.speechRate.toFixed(1)}×`}
          onMinus={() => s.set({ speechRate: clamp(Math.round((s.speechRate - 0.1) * 10) / 10, 0.6, 1.6) })}
          onPlus={() => s.set({ speechRate: clamp(Math.round((s.speechRate + 0.1) * 10) / 10, 0.6, 1.6) })}
        />
        <ButtonRow label={`Stimme: ${voiceName}`} note={voices.length ? `${voices.length} Stimmen verfügbar` : 'Keine weiteren Stimmen gefunden'} onPress={() => setShowVoices((v) => !v)} />
        {showVoices ? (
          <View>
            <Pressable style={styles.voiceRow} onPress={() => s.set({ voiceId: null })}>
              <Text style={[styles.voiceText, !s.voiceId && styles.voiceActive]}>Standardstimme</Text>
            </Pressable>
            {voices.map((v) => (
              <Pressable key={v.identifier} style={styles.voiceRow} onPress={() => s.set({ voiceId: v.identifier })}>
                <Text style={[styles.voiceText, s.voiceId === v.identifier && styles.voiceActive]}>
                  {v.name} <Text style={styles.voiceMeta}>{v.language}{v.quality === 'Enhanced' ? ' · hohe Qualität' : ''}</Text>
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <ButtonRow
          label="Ansage testen"
          note="Spricht ein Beispiel mit den aktuellen Einstellungen"
          onPress={() => {
            const cur = currentDriveSettings();
            speakWithSettings(
              exampleAnnouncement({ language: cur.voiceLanguage, style: cur.announceStyle, shape: cur.announceShape, units: cur.units }),
              cur,
            );
          }}
        />
      </Section>

      <Section title="Anzeige">
        <ChoiceRow
          label="Ausrichtung"
          note="Quer ist für ein Handy am Lenker gedacht. Wirkt erst nach einem neuen App-Build."
          value={s.orientation}
          options={[{ value: 'auto', label: 'Automatisch' }, { value: 'portrait', label: 'Hoch' }, { value: 'landscape', label: 'Quer' }]}
          onChange={(v) => {
            s.set({ orientation: v });
            void applyOrientation(v);
          }}
        />
        <ChoiceRow
          label="Einheiten"
          value={s.units}
          options={[{ value: 'metric', label: 'km · m' }, { value: 'imperial', label: 'mi · ft' }]}
          onChange={(v) => s.set({ units: v })}
        />
        <ChoiceRow
          label="Verkehr"
          note="Bestimmt die Spur, in der die Fahrlinie gezeichnet wird."
          value={s.driveSide}
          options={[{ value: 'right', label: 'Rechtsverkehr' }, { value: 'left', label: 'Linksverkehr' }]}
          onChange={(v) => s.set({ driveSide: v })}
        />
        <ToggleRow label="Fahrlinie zeigen" note="Rein geometrischer Vorschlag innerhalb der eigenen Spur" value={s.showRidingLine} onChange={(v) => s.set({ showRidingLine: v })} />
        <StepperRow
          label="Weitere Kurven in der Liste"
          value={String(s.listCount)}
          onMinus={() => s.set({ listCount: clamp(s.listCount - 1, 0, 4) })}
          onPlus={() => s.set({ listCount: clamp(s.listCount + 1, 0, 4) })}
        />
      </Section>

      <Section title="Sonstiges">
        <ButtonRow
          label="Einstellungen zurücksetzen"
          danger
          onPress={() =>
            Alert.alert('Einstellungen zurücksetzen?', 'Alle Einstellungen gehen auf die Standardwerte zurück. Strecken bleiben erhalten.', [
              { text: 'Abbrechen', style: 'cancel' },
              { text: 'Zurücksetzen', style: 'destructive', onPress: () => { s.reset(); void applyOrientation('auto'); } },
            ])
          }
        />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  voiceRow: { paddingHorizontal: 24, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  voiceText: { color: colors.text, fontSize: 16 },
  voiceActive: { color: colors.accent, fontWeight: '800' },
  voiceMeta: { color: colors.muted, fontSize: 12, fontWeight: '400' },
});
