"""One-off: appends the Phase 2 curated exercises to src/domain/exercises/library.ts.
Each row carries the same engine fields as the originals plus the v2 library
fields. Ratios are reference working loads for a male intermediate lifter as a
fraction of bodyweight; dumbbell ratios are per hand."""
import pathlib, re

ALL, GYM, GYM_DB = 'ALL', 'GYM', 'GYM_DB'

# (id, primary, secondary, region, implement, equipment, patterns, ratio, minTier, category, animation, flags, movement, force, plane, purpose, type, sfr, tempo, breathing, materials, regressions, progressions, mediaId)
ROWS = [
 # ---- squat / lunge
 ('split_squat','quads',['glutes'],'lower','bodyweight',ALL,['loaded_lunge','deep_knee_flexion'],0,'beginner','accessory','split_squat',{'unilateral':True},'lunge','push','sagittal','strengthen','training','high','3010','exhale_effort',[],['reverse_lunge'],['bulgarian_split_squat'],'Split_Squats'),
 ('pistol_squat','quads',['glutes','abs'],'lower','bodyweight',ALL,['deep_knee_flexion','loaded_lunge'],0,'advanced','compound','squat',{'unilateral':True},'squat','push','sagittal','strengthen','training','low','3010','exhale_effort',['box'],['bulgarian_split_squat','bodyweight_squat'],[],None),
 ('sissy_squat','quads',[],'lower','bodyweight',ALL,['deep_knee_flexion','knee_extension_loaded'],0,'advanced','isolation','squat',{},'isolation','push','sagittal','strengthen','training','moderate','3010','exhale_effort',[],['leg_extension','bodyweight_squat'],[],None),
 # ---- hinge
 ('trap_bar_deadlift','hamstrings',['glutes','quads','back'],'lower','barbell',GYM,['loaded_hip_hinge','spinal_loading'],1.3,'intermediate','compound','deadlift',{},'hinge','pull','sagittal','strengthen','training','moderate','2010','brace',[],['dumbbell_rdl','romanian_deadlift'],['conventional_deadlift'],'Trap_Bar_Deadlift'),
 ('sumo_deadlift','glutes',['hamstrings','quads','back'],'lower','barbell',GYM,['loaded_hip_hinge','spinal_loading'],1.2,'intermediate','compound','deadlift',{'bigLift':True},'hinge','pull','sagittal','strengthen','training','moderate','2010','brace',[],['trap_bar_deadlift','romanian_deadlift'],[],'Sumo_Deadlift'),
 ('good_morning','hamstrings',['glutes','back'],'lower','barbell',GYM,['loaded_hip_hinge','spinal_loading'],0.4,'advanced','accessory','hinge',{},'hinge','pull','sagittal','strengthen','training','low','3010','brace',[],['romanian_deadlift','back_extension'],[],'Good_Morning'),
 ('cable_pull_through','glutes',['hamstrings'],'lower','cable',GYM,['loaded_hip_hinge'],0.4,'beginner','accessory','hinge',{},'hinge','pull','sagittal','strengthen','training','high','2011','exhale_effort',['cable'],['glute_bridge'],['dumbbell_rdl','romanian_deadlift'],'Band_Good_Morning_Pull_Through'),
 ('single_leg_rdl','hamstrings',['glutes'],'lower','dumbbell',GYM_DB,['loaded_hip_hinge'],0.15,'intermediate','accessory','hinge',{'unilateral':True},'hinge','pull','sagittal','stabilise','training','high','3010','brace',[],['dumbbell_rdl'],['romanian_deadlift'],None),
 ('seated_leg_curl','hamstrings',[],'lower','machine',GYM,[],0.45,'beginner','isolation','leg_curl',{'machineId':'leg_curl'},'isolation','pull','sagittal','strengthen','training','high','2011','exhale_effort',['machine'],[],['nordic_curl'],'Seated_Leg_Curl'),
 ('glute_ham_raise','hamstrings',['glutes','back'],'lower','bodyweight',GYM,['loaded_hip_hinge'],0,'advanced','accessory','nordic',{'machineId':'ghd'},'hinge','pull','sagittal','strengthen','training','low','4010','exhale_effort',['machine'],['nordic_curl','leg_curl'],[],'Glute_Ham_Raise'),
 ('back_extension','back',['glutes','hamstrings'],'core','bodyweight',GYM,['loaded_hip_hinge'],0,'beginner','accessory','superman',{'machineId':'hyperextension_bench'},'hinge','pull','sagittal','strengthen','training','high','2011','exhale_effort',['bench'],['superman','bird_dog'],['good_morning','romanian_deadlift'],'Hyperextensions_Back_Extensions'),
 # ---- calves
 ('seated_calf_raise','calves',[],'lower','machine',GYM,[],0.8,'beginner','isolation','calf_raise',{'machineId':'seated_calf'},'isolation','push','sagittal','strengthen','training','high','2012','continuous',['machine'],['bodyweight_calf_raise'],[],'Seated_Calf_Raise'),
 ('single_leg_calf_raise','calves',[],'lower','bodyweight',ALL,[],0,'beginner','isolation','calf_raise',{'unilateral':True},'isolation','push','sagittal','strengthen','training','high','2012','continuous',['box'],['bodyweight_calf_raise'],['dumbbell_calf_raise'],None),
 # ---- chest / push
 ('incline_bench_press','chest',['shoulders','triceps'],'upper','barbell',GYM,[],0.6,'intermediate','compound','incline_press',{},'horizontal_push','push','sagittal','strengthen','training','moderate','2010','brace',['bench'],['incline_dumbbell_press'],[],'Barbell_Incline_Bench_Press_-_Medium_Grip'),
 ('close_grip_bench_press','triceps',['chest','shoulders'],'upper','barbell',GYM,[],0.65,'intermediate','compound','horizontal_push',{},'horizontal_push','push','sagittal','strengthen','training','moderate','2010','brace',['bench'],['diamond_push_up','triceps_pushdown'],[],'Close-Grip_Barbell_Bench_Press'),
 ('dip','chest',['triceps','shoulders'],'upper','bodyweight',GYM,[],0,'intermediate','compound','dip',{},'vertical_push','push','sagittal','strengthen','training','moderate','2010','exhale_effort',['bar'],['bench_dip','push_up'],[],'Dips_-_Chest_Version'),
 ('incline_push_up','chest',['triceps'],'upper','bodyweight',ALL,['loaded_wrist_extension'],0,'beginner','compound','push_up',{},'horizontal_push','push','sagittal','strengthen','training','high','2010','exhale_effort',['bench'],['wall_slide'],['push_up'],'Incline_Push-Up'),
 ('decline_push_up','chest',['shoulders','triceps'],'upper','bodyweight',ALL,['loaded_wrist_extension'],0,'intermediate','compound','push_up',{},'horizontal_push','push','sagittal','strengthen','training','high','2010','exhale_effort',['bench'],['push_up'],['dip'],'Decline_Push-Up'),
 ('diamond_push_up','triceps',['chest'],'upper','bodyweight',ALL,['loaded_wrist_extension'],0,'intermediate','accessory','push_up',{},'horizontal_push','push','sagittal','strengthen','training','high','2010','exhale_effort',[],['push_up','bench_dip'],['close_grip_bench_press'],None),
 ('machine_fly','chest',[],'upper','machine',GYM,[],0.4,'beginner','isolation','fly',{'machineId':'pec_deck'},'isolation','push','transverse','strengthen','training','high','2011','exhale_effort',['machine'],['dumbbell_fly'],['cable_fly'],'Butterfly'),
 # ---- shoulders
 ('arnold_press','shoulders',['triceps','chest'],'upper','dumbbell',GYM_DB,['overhead_press'],0.18,'intermediate','compound','seated_press',{},'vertical_push','push','multi','strengthen','training','high','2010','exhale_effort',['bench'],['dumbbell_shoulder_press'],[],'Arnold_Dumbbell_Press'),
 ('landmine_press','shoulders',['chest','triceps'],'upper','barbell',GYM,[],0.3,'beginner','compound','incline_press',{'unilateral':True},'vertical_push','push','sagittal','strengthen','rehab','high','2010','exhale_effort',[],['pike_push_up'],['overhead_press'],None),
 ('cable_lateral_raise','shoulders',[],'upper','cable',GYM,[],0.06,'beginner','isolation','lateral_raise',{'unilateral':True},'isolation','pull','frontal','strengthen','training','high','2011','continuous',['cable'],['lateral_raise'],[],None),
 ('band_pull_apart','shoulders',['back'],'upper','bodyweight',GYM_DB,[],0,'beginner','isolation','rear_delt_fly',{},'horizontal_pull','pull','transverse','stabilise','warmup','high','2011','continuous',['band'],[],['face_pull','rear_delt_fly'],'Band_Pull_Apart'),
 ('y_raise','shoulders',['back'],'upper','dumbbell',GYM_DB,[],0.04,'beginner','isolation','lateral_raise',{},'isolation','pull','frontal','stabilise','rehab','high','2011','continuous',['bench'],['wall_slide'],['lateral_raise'],None),
 # ---- back / pull
 ('chin_up','back',['biceps'],'upper','bodyweight',GYM,[],0,'intermediate','compound','vertical_pull',{},'vertical_pull','pull','sagittal','strengthen','training','moderate','2011','exhale_effort',['bar'],['assisted_pull_up','lat_pulldown'],['pull_up'],'Chin-Up'),
 ('assisted_pull_up','back',['biceps'],'upper','machine',GYM,[],0.5,'beginner','compound','vertical_pull',{'machineId':'assisted_pullup'},'vertical_pull','pull','sagittal','strengthen','training','high','2011','exhale_effort',['machine'],['lat_pulldown'],['chin_up','pull_up'],'Band_Assisted_Pull-Up'),
 ('pendlay_row','back',['biceps','hamstrings'],'upper','barbell',GYM,['loaded_hip_hinge','spinal_loading'],0.6,'advanced','compound','horizontal_pull',{},'horizontal_pull','pull','sagittal','strengthen','training','low','X010','brace',[],['barbell_row','chest_supported_row'],[],None),
 ('t_bar_row','back',['biceps'],'upper','machine',GYM,['loaded_hip_hinge'],0.7,'intermediate','compound','horizontal_pull',{'machineId':'t_bar'},'horizontal_pull','pull','sagittal','strengthen','training','moderate','2011','brace',['machine'],['chest_supported_row','seated_cable_row'],['barbell_row'],'T-Bar_Row_with_Handle'),
 ('suspension_row','back',['biceps'],'upper','bodyweight',GYM_DB,[],0,'beginner','compound','inverted_row',{},'horizontal_pull','pull','sagittal','strengthen','training','high','2011','exhale_effort',['suspension'],['band_pull_apart'],['inverted_row','dumbbell_row'],'Inverted_Row_with_Straps'),
 ('straight_arm_pulldown','back',[],'upper','cable',GYM,[],0.25,'beginner','isolation','lat_pulldown',{},'isolation','pull','sagittal','strengthen','training','high','2011','exhale_effort',['cable'],[],['lat_pulldown'],'Straight-Arm_Pulldown'),
 ('bird_dog','back',['abs','glutes'],'core','bodyweight',ALL,[],0,'beginner','core','dead_bug',{'unilateral':True},'anti_rotation','static','multi','stabilise','rehab','high','2020','slow',[],['cat_cow'],['superman','plank'],None),
 # ---- arms
 ('preacher_curl','biceps',[],'upper','barbell',GYM,[],0.2,'beginner','isolation','curl',{'machineId':'preacher_bench'},'isolation','pull','sagittal','strengthen','training','high','3010','continuous',['bench'],['dumbbell_curl'],[],'Preacher_Curl'),
 ('incline_dumbbell_curl','biceps',[],'upper','dumbbell',GYM_DB,[],0.1,'intermediate','isolation','curl',{},'isolation','pull','sagittal','strengthen','training','high','3010','continuous',['bench'],['dumbbell_curl'],[],'Incline_Dumbbell_Curl'),
 ('concentration_curl','biceps',[],'upper','dumbbell',GYM_DB,[],0.1,'beginner','isolation','curl',{'unilateral':True},'isolation','pull','sagittal','strengthen','training','high','2011','continuous',['bench'],['dumbbell_curl'],[],'Concentration_Curls'),
 ('cable_overhead_triceps_extension','triceps',[],'upper','cable',GYM,['overhead_press'],0.25,'beginner','isolation','overhead_extension',{},'isolation','push','sagittal','strengthen','training','high','3010','continuous',['cable'],['triceps_pushdown'],[],'Triceps_Overhead_Extension_with_Rope'),
 ('triceps_kickback','triceps',[],'upper','dumbbell',GYM_DB,[],0.06,'beginner','isolation','pushdown',{'unilateral':True},'isolation','push','sagittal','strengthen','training','high','2011','continuous',['bench'],[],['skull_crusher'],'Tricep_Dumbbell_Kickback'),
 # ---- core
 ('ab_wheel_rollout','abs',['back'],'core','bodyweight',GYM_DB,['spinal_loading'],0,'intermediate','core','plank',{},'anti_extension','static','sagittal','strengthen','training','moderate','3010','brace',['other'],['plank','dead_bug'],[],'Ab_Roller'),
 ('hanging_leg_raise','abs',[],'core','bodyweight',GYM,['deep_hip_flexion'],0,'advanced','core','knee_raise',{},'isolation','pull','sagittal','strengthen','training','moderate','2011','exhale_effort',['bar'],['hanging_knee_raise','reverse_crunch'],[],'Hanging_Leg_Raise'),
 ('copenhagen_plank','abs',['glutes'],'core','bodyweight',GYM_DB,[],0,'intermediate','core','side_plank',{'unilateral':True,'timed':True},'anti_lateral_flexion','static','frontal','stabilise','rehab','moderate','hold','slow',['bench'],['side_plank'],[],None),
 ('suitcase_carry','abs',['back','shoulders'],'core','dumbbell',GYM_DB,[],0.35,'beginner','core','carry',{'unilateral':True,'timed':True},'carry','static','frontal','stabilise','training','high','hold','continuous',[],['side_plank'],['farmers_carry'],None),
 ('russian_twist','abs',[],'core','bodyweight',ALL,['spinal_loading'],0,'beginner','core','bicycle',{},'rotation','pull','transverse','strengthen','training','high','2010','continuous',[],['pallof_press','dead_bug'],[],'Russian_Twist'),
 ('reverse_crunch','abs',[],'core','bodyweight',ALL,['deep_hip_flexion'],0,'beginner','core','crunch',{},'isolation','pull','sagittal','strengthen','training','high','2011','exhale_effort',[],['dead_bug'],['hanging_knee_raise'],'Reverse_Crunch'),
]

def lit(xs):
    return '[' + ', '.join(f"'{x}'" for x in xs) + ']'

lines = []
for (ident, primary, secondary, region, implement, equipment, patterns, ratio, tier, category, anim, flags, movement, force, plane, purpose, typ, sfr, tempo, breathing, materials, regs, progs, media) in ROWS:
    s = f"  {{ id: '{ident}', primary: '{primary}', secondary: {lit(secondary)}, region: '{region}', implement: '{implement}', equipment: {equipment}, patterns: {lit(patterns)}, strengthRatio: {ratio}, minTier: '{tier}'"
    if flags.get('bigLift'): s += ', bigLift: true'
    s += f", category: '{category}'"
    if flags.get('machineId'): s += f", machineId: '{flags['machineId']}'"
    s += f", animation: '{anim}'"
    if flags.get('unilateral'): s += ', unilateral: true'
    if flags.get('timed'): s += ', timed: true'
    s += f", movement: '{movement}', force: '{force}', plane: '{plane}', purpose: '{purpose}', type: '{typ}', sfr: '{sfr}', tempo: '{tempo}', breathing: '{breathing}'"
    if materials: s += f", materials: {lit(materials)}"
    if regs: s += f", regressions: {lit(regs)}"
    if progs: s += f", progressions: {lit(progs)}"
    if media: s += f", mediaId: '{media}'"
    s += ' },'
    lines.append(s)

path = pathlib.Path('src/domain/exercises/library.ts')
src = path.read_text()
marker = "  { id: 'glute_bridge_hold'"
idx = src.index(marker)
end = src.index('\n', idx) + 1
block = '\n  // ------------------------------------------------ phase 2 additions --\n' + '\n'.join(lines) + '\n'
path.write_text(src[:end] + block + src[end:])
print('appended', len(lines), 'rows')
