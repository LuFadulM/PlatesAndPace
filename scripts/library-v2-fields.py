"""One-off: adds the library v2 fields (movement, force, plane, purpose, type,
stimulus-to-fatigue, tempo, breathing, materials, graph edges, photo id) to
every existing row of src/domain/exercises/library.ts in place. The TypeScript
file is the source of truth once written; this script exists so the coaching
judgement behind each row is reviewable in one table."""
import pathlib, re

# id: (movement, force, plane, purpose, type, sfr, tempo, breathing, materials, regressions, progressions, mediaId)
STRENGTH = ('strengthen', 'training')
V2 = {
 # quads
 'back_squat': ('squat','push','sagittal',*STRENGTH,'moderate','3010','brace',[],['goblet_squat','leg_press'],['front_squat'],'Barbell_Squat'),
 'front_squat': ('squat','push','sagittal',*STRENGTH,'moderate','3010','brace',[],['back_squat','goblet_squat'],[],'Front_Barbell_Squat'),
 'goblet_squat': ('squat','push','sagittal',*STRENGTH,'high','3010','brace',[],['bodyweight_squat'],['back_squat','hack_squat'],'Goblet_Squat'),
 'leg_press': ('squat','push','sagittal',*STRENGTH,'high','2010','exhale_effort',['machine'],['bodyweight_squat'],['hack_squat','back_squat'],'Leg_Press'),
 'hack_squat': ('squat','push','sagittal',*STRENGTH,'high','3010','brace',['machine'],['leg_press','goblet_squat'],['back_squat'],'Hack_Squat'),
 'bulgarian_split_squat': ('lunge','push','sagittal',*STRENGTH,'moderate','3010','exhale_effort',['bench'],['split_squat','reverse_lunge'],['pistol_squat'],None),
 'walking_lunge': ('lunge','push','sagittal',*STRENGTH,'moderate','2010','exhale_effort',[],['reverse_lunge','split_squat'],['bulgarian_split_squat'],'Bodyweight_Walking_Lunge'),
 'step_up': ('lunge','push','sagittal',*STRENGTH,'high','2010','exhale_effort',['box'],['bodyweight_squat'],['bulgarian_split_squat'],'Dumbbell_Step_Ups'),
 'bodyweight_squat': ('squat','push','sagittal',*STRENGTH,'high','3010','exhale_effort',[],['deep_squat_hold'],['goblet_squat','split_squat','pistol_squat'],'Bodyweight_Squat'),
 'reverse_lunge': ('lunge','push','sagittal',*STRENGTH,'high','2010','exhale_effort',[],['split_squat','step_up'],['walking_lunge','bulgarian_split_squat'],None),
 'leg_extension': ('isolation','push','sagittal',*STRENGTH,'high','2011','exhale_effort',['machine'],[],['sissy_squat'],'Leg_Extensions'),
 # hinge
 'conventional_deadlift': ('hinge','pull','sagittal',*STRENGTH,'low','2010','brace',[],['trap_bar_deadlift','romanian_deadlift'],['sumo_deadlift'],'Barbell_Deadlift'),
 'romanian_deadlift': ('hinge','pull','sagittal',*STRENGTH,'moderate','3010','brace',[],['dumbbell_rdl'],['conventional_deadlift','good_morning'],'Romanian_Deadlift'),
 'dumbbell_rdl': ('hinge','pull','sagittal',*STRENGTH,'high','3010','brace',[],['glute_bridge','cable_pull_through'],['romanian_deadlift','single_leg_rdl'],None),
 'leg_curl': ('isolation','pull','sagittal',*STRENGTH,'high','2011','exhale_effort',['machine'],[],['nordic_curl','glute_ham_raise'],'Lying_Leg_Curls'),
 'nordic_curl': ('isolation','pull','sagittal',*STRENGTH,'low','4010','exhale_effort',[],['leg_curl','glute_bridge'],['glute_ham_raise'],'Natural_Glute_Ham_Raise'),
 # glutes
 'hip_thrust': ('hinge','push','sagittal',*STRENGTH,'high','2011','exhale_effort',['bench'],['dumbbell_hip_thrust','glute_bridge'],[],'Barbell_Hip_Thrust'),
 'dumbbell_hip_thrust': ('hinge','push','sagittal',*STRENGTH,'high','2011','exhale_effort',['bench'],['glute_bridge'],['hip_thrust'],None),
 'glute_bridge': ('hinge','push','sagittal',*STRENGTH,'high','2011','exhale_effort',[],['glute_bridge_hold'],['single_leg_glute_bridge','dumbbell_hip_thrust'],'Butt_Lift_Bridge'),
 'cable_kickback': ('isolation','push','sagittal',*STRENGTH,'high','2011','exhale_effort',['cable'],['single_leg_glute_bridge'],['hip_thrust'],'Glute_Kickback'),
 'hip_abduction': ('isolation','push','frontal',*STRENGTH,'high','2011','exhale_effort',['machine'],[],[],'Thigh_Abductor'),
 'single_leg_glute_bridge': ('hinge','push','sagittal',*STRENGTH,'high','2011','exhale_effort',[],['glute_bridge'],['dumbbell_hip_thrust'],'Single_Leg_Glute_Bridge'),
 # calves
 'standing_calf_raise': ('isolation','push','sagittal',*STRENGTH,'high','2012','continuous',['machine'],['bodyweight_calf_raise'],[],'Standing_Calf_Raises'),
 'dumbbell_calf_raise': ('isolation','push','sagittal',*STRENGTH,'high','2012','continuous',[],['bodyweight_calf_raise'],['single_leg_calf_raise','standing_calf_raise'],'Standing_Dumbbell_Calf_Raise'),
 'bodyweight_calf_raise': ('isolation','push','sagittal',*STRENGTH,'high','2012','continuous',[],['calf_stretch'],['single_leg_calf_raise','dumbbell_calf_raise'],None),
 # chest
 'bench_press': ('horizontal_push','push','sagittal',*STRENGTH,'moderate','2010','brace',['bench'],['dumbbell_bench_press','push_up'],['close_grip_bench_press','incline_bench_press'],'Barbell_Bench_Press_-_Medium_Grip'),
 'dumbbell_bench_press': ('horizontal_push','push','sagittal',*STRENGTH,'high','2010','exhale_effort',['bench'],['push_up','chest_press_machine'],['bench_press','incline_dumbbell_press'],'Dumbbell_Bench_Press'),
 'incline_dumbbell_press': ('horizontal_push','push','sagittal',*STRENGTH,'high','2010','exhale_effort',['bench'],['dumbbell_bench_press'],['incline_bench_press'],'Incline_Dumbbell_Press'),
 'chest_press_machine': ('horizontal_push','push','sagittal',*STRENGTH,'high','2010','exhale_effort',['machine'],['push_up'],['dumbbell_bench_press'],'Machine_Bench_Press'),
 'push_up': ('horizontal_push','push','sagittal',*STRENGTH,'high','2010','exhale_effort',[],['incline_push_up'],['decline_push_up','dip','dumbbell_bench_press'],'Pushups'),
 'cable_fly': ('isolation','push','transverse',*STRENGTH,'high','2011','exhale_effort',['cable'],['dumbbell_fly'],[],'Cable_Crossover'),
 'dumbbell_fly': ('isolation','push','transverse',*STRENGTH,'moderate','3010','exhale_effort',['bench'],[],['cable_fly','machine_fly'],'Dumbbell_Flyes'),
 # shoulders
 'overhead_press': ('vertical_push','push','sagittal',*STRENGTH,'moderate','2010','brace',[],['dumbbell_shoulder_press','landmine_press'],['push_press'],'Standing_Military_Press'),
 'dumbbell_shoulder_press': ('vertical_push','push','sagittal',*STRENGTH,'high','2010','exhale_effort',[],['machine_shoulder_press','pike_push_up'],['overhead_press','arnold_press'],'Dumbbell_Shoulder_Press'),
 'machine_shoulder_press': ('vertical_push','push','sagittal',*STRENGTH,'high','2010','exhale_effort',['machine'],['pike_push_up'],['dumbbell_shoulder_press'],'Machine_Shoulder_Military_Press'),
 'pike_push_up': ('vertical_push','push','sagittal',*STRENGTH,'high','2010','exhale_effort',[],['push_up','wall_slide'],['dumbbell_shoulder_press'],None),
 'lateral_raise': ('isolation','pull','frontal',*STRENGTH,'high','2011','continuous',[],[],['cable_lateral_raise'],'Side_Lateral_Raise'),
 'face_pull': ('horizontal_pull','pull','transverse',*STRENGTH,'high','2011','continuous',['cable'],['band_pull_apart','rear_delt_fly'],[],'Face_Pull'),
 'rear_delt_fly': ('isolation','pull','transverse',*STRENGTH,'high','2011','continuous',[],['band_pull_apart'],['face_pull'],'Reverse_Flyes'),
 # back
 'barbell_row': ('horizontal_pull','pull','sagittal',*STRENGTH,'moderate','2011','brace',[],['chest_supported_row','dumbbell_row'],['pendlay_row'],'Bent_Over_Barbell_Row'),
 'dumbbell_row': ('horizontal_pull','pull','sagittal',*STRENGTH,'high','2011','exhale_effort',['bench'],['inverted_row','seated_cable_row'],['barbell_row'],'One-Arm_Dumbbell_Row'),
 'chest_supported_row': ('horizontal_pull','pull','sagittal',*STRENGTH,'high','2011','exhale_effort',['machine'],['seated_cable_row'],['dumbbell_row','t_bar_row'],None),
 'seated_cable_row': ('horizontal_pull','pull','sagittal',*STRENGTH,'high','2011','exhale_effort',['cable'],['inverted_row'],['chest_supported_row','barbell_row'],'Seated_Cable_Rows'),
 'lat_pulldown': ('vertical_pull','pull','sagittal',*STRENGTH,'high','2011','exhale_effort',['machine'],['straight_arm_pulldown'],['assisted_pull_up','chin_up','pull_up'],'Wide-Grip_Lat_Pulldown'),
 'pull_up': ('vertical_pull','pull','sagittal',*STRENGTH,'moderate','2011','exhale_effort',['bar'],['chin_up','assisted_pull_up','lat_pulldown'],[],'Pullups'),
 'inverted_row': ('horizontal_pull','pull','sagittal',*STRENGTH,'high','2011','exhale_effort',['bar'],['suspension_row','superman'],['dumbbell_row','chin_up'],'Inverted_Row'),
 'superman': ('anti_extension','static','sagittal','stabilise','training','high','2020','continuous',[],['bird_dog'],['back_extension','inverted_row'],'Superman'),
 # arms
 'dumbbell_curl': ('isolation','pull','sagittal',*STRENGTH,'high','2011','continuous',[],[],['incline_dumbbell_curl','barbell_curl'],'Dumbbell_Bicep_Curl'),
 'hammer_curl': ('isolation','pull','sagittal',*STRENGTH,'high','2011','continuous',[],[],['barbell_curl'],'Hammer_Curls'),
 'cable_curl': ('isolation','pull','sagittal',*STRENGTH,'high','2011','continuous',['cable'],['dumbbell_curl'],['barbell_curl'],None),
 'barbell_curl': ('isolation','pull','sagittal',*STRENGTH,'high','2011','continuous',[],['dumbbell_curl','cable_curl'],['preacher_curl'],'Barbell_Curl'),
 'triceps_pushdown': ('isolation','push','sagittal',*STRENGTH,'high','2011','continuous',['cable'],['bench_dip'],['close_grip_bench_press','cable_overhead_triceps_extension'],'Triceps_Pushdown'),
 'overhead_triceps_extension': ('isolation','push','sagittal',*STRENGTH,'high','3010','continuous',[],['triceps_pushdown'],['cable_overhead_triceps_extension'],None),
 'bench_dip': ('vertical_push','push','sagittal',*STRENGTH,'moderate','2010','exhale_effort',['bench'],['diamond_push_up'],['dip'],'Bench_Dips'),
 'skull_crusher': ('isolation','push','sagittal',*STRENGTH,'moderate','3010','continuous',['bench'],['triceps_pushdown'],['close_grip_bench_press'],'EZ-Bar_Skullcrusher'),
 # core
 'plank': ('anti_extension','static','sagittal','stabilise','training','high','hold','slow',[],['dead_bug'],['ab_wheel_rollout','copenhagen_plank'],'Plank'),
 'side_plank': ('anti_lateral_flexion','static','frontal','stabilise','training','high','hold','slow',[],['dead_bug'],['copenhagen_plank','suitcase_carry'],'Side_Bridge'),
 'dead_bug': ('anti_extension','static','sagittal','stabilise','training','high','3010','slow',[],['cat_cow'],['plank','bird_dog'],'Dead_Bug'),
 'hanging_knee_raise': ('isolation','pull','sagittal',*STRENGTH,'moderate','2011','exhale_effort',['bar'],['reverse_crunch','dead_bug'],['hanging_leg_raise'],None),
 'cable_crunch': ('isolation','pull','sagittal',*STRENGTH,'high','2011','exhale_effort',['cable'],['bicycle_crunch'],['ab_wheel_rollout'],'Cable_Crunch'),
 'pallof_press': ('anti_rotation','static','transverse','stabilise','training','high','2020','slow',['cable'],['side_plank'],['russian_twist'],'Pallof_Press'),
 'bicycle_crunch': ('rotation','pull','transverse',*STRENGTH,'high','2010','continuous',[],['dead_bug'],['russian_twist','hanging_knee_raise'],'Air_Bike'),
 # conditioning
 'burpee': ('gait','push','multi','cardio','training','low','X','continuous',[],['jumping_jack','mountain_climber'],[],None),
 'jump_squat': ('squat','push','sagittal','cardio','training','moderate','X','continuous',[],['bodyweight_squat'],['box_jump'],'Freehand_Jump_Squat'),
 'mountain_climber': ('gait','push','sagittal','cardio','training','moderate','X','continuous',[],['plank'],['burpee'],'Mountain_Climbers'),
 'jumping_jack': ('gait','push','frontal','cardio','warmup','high','X','continuous',[],[],['burpee'],None),
 'farmers_carry': ('carry','static','sagittal','stabilise','training','high','hold','continuous',[],['suitcase_carry'],[],'Farmers_Walk'),
 'dumbbell_swing': ('hinge','pull','sagittal','cardio','training','moderate','X','exhale_effort',[],['glute_bridge','dumbbell_rdl'],['kettlebell_swing'],None),
 'bike_intervals': ('gait','push','sagittal','cardio','training','high','X','continuous',['machine'],[],[],None),
 'rower_intervals': ('horizontal_pull','pull','sagittal','cardio','training','high','X','continuous',['machine'],[],[],None),
 # power
 'box_jump': ('squat','push','sagittal','nervous_system','training','moderate','X','exhale_effort',['box'],['jump_squat'],['broad_jump'],'Front_Box_Jump'),
 'broad_jump': ('hinge','push','sagittal','nervous_system','training','moderate','X','exhale_effort',[],['jump_squat','box_jump'],[],None),
 'push_press': ('vertical_push','push','sagittal','nervous_system','training','moderate','X','brace',[],['dumbbell_push_press','overhead_press'],[],'Push_Press'),
 'dumbbell_push_press': ('vertical_push','push','sagittal','nervous_system','training','high','X','exhale_effort',[],['dumbbell_shoulder_press'],['push_press'],None),
 'kettlebell_swing': ('hinge','pull','sagittal','nervous_system','training','high','X','exhale_effort',['kettlebell'],['dumbbell_swing','dumbbell_rdl'],[],'One-Arm_Kettlebell_Swings'),
 'medicine_ball_slam': ('anti_extension','push','sagittal','nervous_system','training','high','X','exhale_effort',['medicine_ball'],['cable_crunch'],[],'One-Arm_Medicine_Ball_Slam'),
 # mobility
 'hip_flexor_stretch': ('lunge','static','sagittal','mobilise','stretch','high','hold','slow',[],[],[],'Kneeling_Hip_Flexor'),
 'worlds_greatest_stretch': ('lunge','static','multi','mobilise','warmup','high','hold','slow',[],['hip_flexor_stretch'],[],None),
 'ninety_ninety_hip': ('rotation','static','transverse','mobilise','stretch','high','hold','slow',[],[],[],None),
 'thoracic_rotation': ('rotation','static','transverse','mobilise','warmup','high','hold','slow',[],['cat_cow'],[],None),
 'cat_cow': ('anti_extension','static','sagittal','mobilise','warmup','high','hold','slow',[],[],['dead_bug'],'Cat_Stretch'),
 'shoulder_dislocate': ('vertical_push','static','sagittal','mobilise','warmup','high','hold','slow',['band'],['wall_slide'],[],'Shoulder_Circles'),
 'wall_slide': ('vertical_push','static','frontal','mobilise','rehab','high','hold','slow',[],[],['pike_push_up','shoulder_dislocate'],None),
 'calf_stretch': ('isolation','static','sagittal','mobilise','stretch','high','hold','slow',['box'],[],['bodyweight_calf_raise'],'Calf_Stretch_Hands_Against_Wall'),
 'deep_squat_hold': ('squat','static','sagittal','mobilise','warmup','high','hold','slow',[],[],['bodyweight_squat'],None),
 'glute_bridge_hold': ('hinge','static','sagittal','mobilise','rehab','high','hold','slow',[],[],['glute_bridge'],None),
}

import json, os
DUMP = os.environ.get('FEDB', '/tmp/claude-0/-home-user-platesandpace/2c2ffe6c-dbbb-5177-978b-2a654660f477/scratchpad/fedb.json')
DATASET_IDS = {e['id'] for e in json.load(open(DUMP))}

path = pathlib.Path('src/domain/exercises/library.ts')
src = path.read_text()
out = []
seen = set()
for line in src.split('\n'):
    m = re.match(r"^(\s*\{ id: '([a-z_0-9]+)',.*), animation: '([a-z_]+)'(.*)\},\s*$", line)
    if not m:
        out.append(line)
        continue
    head, ident, anim, rest = m.groups()
    v = V2.get(ident)
    if v is None:
        raise SystemExit(f'no v2 row for {ident}')
    seen.add(ident)
    movement, force, plane, purpose, typ, sfr, tempo, breathing, materials, regs, progs, media = v
    extra = f", movement: '{movement}', force: '{force}', plane: '{plane}', purpose: '{purpose}', type: '{typ}', sfr: '{sfr}', tempo: '{tempo}', breathing: '{breathing}'"
    if materials: extra += ", materials: [" + ', '.join(f"'{x}'" for x in materials) + "]"
    if regs: extra += ", regressions: [" + ', '.join(f"'{x}'" for x in regs) + "]"
    if progs: extra += ", progressions: [" + ', '.join(f"'{x}'" for x in progs) + "]"
    if media:
        if media not in DATASET_IDS: raise SystemExit(f'{ident}: unknown media id {media}')
        extra += f", mediaId: '{media}'"
    out.append(f"{head}, animation: '{anim}'{rest}{extra} }},")
missing = set(V2) - seen
if missing:
    raise SystemExit(f'rows not found in library: {sorted(missing)}')
path.write_text('\n'.join(out))
print('updated', len(seen), 'rows')
