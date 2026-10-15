import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFormat } from '../i18n';
import { applyOrientation } from '../services/orientation';
import { shareTextFile } from '../services/exporter';
import { speakWithSettings, voicesFor, type Voice } from '../services/speech';
import { useFeedbackStore } from '../stores/feedbackStore';
import { currentDriveSettings, useSettingsStore } from '../stores/settingsStore';
import { exampleAnnouncement } from '../voice/phrases';
import { colors } from '../theme';
import { ButtonRow, ChoiceRow, Section, StepperRow, ToggleRow, clamp } from './SettingsRows';

export function SettingsView() {
  const s = useSettingsStore();
  const f = useFormat();
  const marks = useFeedbackStore((m) => m.marks);
  const clearMarks = useFeedbackStore((m) => m.clear);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [showVoices, setShowVoices] = useState(false);

  useEffect(() => {
    let cancelled = false;
    voicesFor(s.voiceLanguage).then((v) => !cancelled && setVoices(v));
    return () => {
      cancelled = true;
    };
  }, [s.voiceLanguage]);

  const voiceName = s.voiceId ? (voices.find((v) => v.identifier === s.voiceId)?.name ?? f.t('set.voiceSelected')) : f.t('set.voiceDefault');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Section title={f.t('set.sec.announce')}>
        <ToggleRow label={f.t('set.voiceEnabled')} value={s.voiceEnabled} onChange={(v) => s.set({ voiceEnabled: v })} />
        <StepperRow
          label={f.t('set.minGrade')}
          note={f.t('set.minGradeNote', { what: f.t(`set.grade.${s.minAnnounceGrade}` as 'set.grade.1') })}
          value={f.t('set.gradeValue', { n: s.minAnnounceGrade })}
          onMinus={() => s.set({ minAnnounceGrade: clamp(s.minAnnounceGrade - 1, 1, 6) })}
          onPlus={() => s.set({ minAnnounceGrade: clamp(s.minAnnounceGrade + 1, 1, 6) })}
        />
        <ChoiceRow
          label={f.t('set.style')}
          value={s.announceStyle}
          options={[{ value: 'long', label: f.t('set.style.long') }, { value: 'short', label: f.t('set.style.short') }]}
          note={f.t(s.announceStyle === 'long' ? 'set.style.longNote' : 'set.style.shortNote')}
          onChange={(v) => s.set({ announceStyle: v })}
        />
        {s.announceStyle === 'long' ? (
          <ToggleRow label={f.t('set.shape')} note={f.t('set.shapeNote')} value={s.announceShape} onChange={(v) => s.set({ announceShape: v })} />
        ) : null}
        <StepperRow
          label={f.t('set.lead')}
          value={`${s.leadSeconds} s`}
          onMinus={() => s.set({ leadSeconds: clamp(s.leadSeconds - 1, 2, 15) })}
          onPlus={() => s.set({ leadSeconds: clamp(s.leadSeconds + 1, 2, 15) })}
        />
        <StepperRow
          label={f.t('set.minLead')}
          value={s.units === 'metric' ? `${s.minLeadM} m` : `${Math.round(s.minLeadM * 3.281 / 10) * 10} ft`}
          onMinus={() => s.set({ minLeadM: clamp(s.minLeadM - 10, 40, 300) })}
          onPlus={() => s.set({ minLeadM: clamp(s.minLeadM + 10, 40, 300) })}
        />
      </Section>

      <Section title={f.t('set.sec.voice')} hint={f.t('set.voiceHint')}>
        <ChoiceRow
          label={f.t('set.voiceLang')}
          value={s.voiceLanguage}
          options={[{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }]}
          onChange={(v) => s.set({ voiceLanguage: v, voiceId: null })}
        />
        <StepperRow
          label={f.t('set.rate')}
          value={`${s.speechRate.toFixed(1)}×`}
          onMinus={() => s.set({ speechRate: clamp(Math.round((s.speechRate - 0.1) * 10) / 10, 0.6, 1.6) })}
          onPlus={() => s.set({ speechRate: clamp(Math.round((s.speechRate + 0.1) * 10) / 10, 0.6, 1.6) })}
        />
        <ButtonRow label={f.t('set.voice', { name: voiceName })} note={voices.length ? f.t('set.voicesAvail', { count: voices.length }) : f.t('set.voicesNone')} onPress={() => setShowVoices((v) => !v)} />
        {showVoices ? (
          <View>
            <Pressable style={styles.voiceRow} onPress={() => s.set({ voiceId: null })}>
              <Text style={[styles.voiceText, !s.voiceId && styles.voiceActive]}>{f.t('set.voiceDefault')}</Text>
            </Pressable>
            {voices.map((v) => (
              <Pressable key={v.identifier} style={styles.voiceRow} onPress={() => s.set({ voiceId: v.identifier })}>
                <Text style={[styles.voiceText, s.voiceId === v.identifier && styles.voiceActive]}>
                  {v.name} <Text style={styles.voiceMeta}>{v.language}{v.quality === 'Enhanced' ? ` · ${f.t('set.highQuality')}` : ''}</Text>
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <ButtonRow
          label={f.t('set.test')}
          note={f.t('set.testNote')}
          onPress={() => {
            const cur = currentDriveSettings();
            speakWithSettings(
              exampleAnnouncement({ language: cur.voiceLanguage, style: cur.announceStyle, shape: cur.announceShape, units: cur.units }),
              cur,
            );
          }}
        />
      </Section>

      <Section title={f.t('set.sec.display')}>
        <ChoiceRow
          label={f.t('set.uiLang')}
          value={s.uiLanguage}
          options={[{ value: 'auto', label: f.t('set.uiLang.auto') }, { value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }]}
          onChange={(v) => s.set({ uiLanguage: v })}
        />
        <ChoiceRow
          label={f.t('set.orientation')}
          note={f.t('set.orientationNote')}
          value={s.orientation}
          options={[{ value: 'auto', label: f.t('set.orient.auto') }, { value: 'portrait', label: f.t('set.orient.portrait') }, { value: 'landscape', label: f.t('set.orient.landscape') }]}
          onChange={(v) => {
            s.set({ orientation: v });
            void applyOrientation(v);
          }}
        />
        <ChoiceRow
          label={f.t('set.units')}
          value={s.units}
          options={[{ value: 'metric', label: f.t('set.units.metric') }, { value: 'imperial', label: f.t('set.units.imperial') }]}
          onChange={(v) => s.set({ units: v })}
        />
        <ChoiceRow
          label={f.t('set.traffic')}
          note={f.t('set.trafficNote')}
          value={s.driveSide}
          options={[{ value: 'right', label: f.t('set.traffic.right') }, { value: 'left', label: f.t('set.traffic.left') }]}
          onChange={(v) => s.set({ driveSide: v })}
        />
        <ToggleRow label={f.t('set.line')} note={f.t('set.lineNote')} value={s.showRidingLine} onChange={(v) => s.set({ showRidingLine: v })} />
        <StepperRow
          label={f.t('set.listCount')}
          value={String(s.listCount)}
          onMinus={() => s.set({ listCount: clamp(s.listCount - 1, 0, 4) })}
          onPlus={() => s.set({ listCount: clamp(s.listCount + 1, 0, 4) })}
        />
      </Section>

      <Section title={f.t('set.sec.feedback')}>
        <ToggleRow
          label={f.t('set.feedbackButtons')}
          note={f.t('set.feedbackButtonsNote')}
          value={s.showFeedbackButtons}
          onChange={(v) => s.set({ showFeedbackButtons: v })}
        />
        <ButtonRow
          label={f.t('set.exportFeedback')}
          note={f.t('set.exportFeedbackNote', { count: marks.length })}
          onPress={() =>
            void shareTextFile(
              'cornerguider-feedback.json',
              JSON.stringify({ app: 'cornerGuider', kind: 'marks', version: 1, marks }),
              f.t('set.exportFeedback'),
            ).catch(() => Alert.alert(f.t('fb.exportFailed')))
          }
        />
        {marks.length > 0 ? (
          <ButtonRow
            label={f.t('set.clearFeedback')}
            danger
            onPress={() =>
              Alert.alert(f.t('set.clearFeedbackTitle'), undefined, [
                { text: f.t('common.cancel'), style: 'cancel' },
                { text: f.t('common.delete'), style: 'destructive', onPress: clearMarks },
              ])
            }
          />
        ) : null}
      </Section>

      <Section title={f.t('set.sec.other')}>
        <ButtonRow
          label={f.t('set.reset')}
          danger
          onPress={() =>
            Alert.alert(f.t('set.resetTitle'), f.t('set.resetText'), [
              { text: f.t('common.cancel'), style: 'cancel' },
              { text: f.t('set.resetConfirm'), style: 'destructive', onPress: () => { s.reset(); void applyOrientation('auto'); } },
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
