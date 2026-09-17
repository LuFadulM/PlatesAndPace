"""One-off: full coaching copy, in both languages, for the Phase 2 exercises.
Merged into messages/{en,es}.json under exercises.<id>. The JSON files are the
source of truth once written; the two languages are authored side by side here
so neither can drift."""
import json, pathlib

# id: {en: (name, aliases, cues[3], mistakes[2], steps[3]), es: (...)}
X = {
 'split_squat': {
  'en': ('Split squat', ['static lunge'], ['Long stance, front shin near vertical', 'Drop the back knee straight down', 'Push through the whole front foot'], ['Stance too short, knee shooting forward', 'Leaning the torso forward'], ['Step one foot a long stride ahead, hips square.', 'Lower until the back knee nearly touches the floor.', 'Drive up through the front foot without shifting the feet.']),
  'es': ('Sentadilla dividida', ['zancada estática'], ['Postura larga, la espinilla delantera casi vertical', 'Baja la rodilla trasera en línea recta', 'Empuja con todo el pie delantero'], ['Postura demasiado corta, la rodilla se dispara hacia adelante', 'Inclinar el torso hacia adelante'], ['Da un paso largo hacia adelante con la cadera al frente.', 'Baja hasta que la rodilla trasera casi toque el suelo.', 'Sube empujando con el pie delantero sin mover los pies.']),
 },
 'pistol_squat': {
  'en': ('Pistol squat', ['single-leg squat', 'one-leg squat'], ['Reach the arms forward as you sit back', 'Keep the whole foot planted', 'Control the descent; the bottom is the hard part'], ['Falling backwards at the bottom', 'Heel lifting'], ['Stand on one leg, the other extended in front.', 'Sit back and down as far as you can control, arms forward for balance.', 'Drive up through the standing foot to full extension.']),
  'es': ('Sentadilla pistol', ['sentadilla a una pierna'], ['Estira los brazos al frente mientras te sientas hacia atrás', 'Mantén todo el pie apoyado', 'Controla la bajada; lo difícil es el fondo'], ['Caerse hacia atrás en el fondo', 'Talón que se levanta'], ['Párate sobre una pierna, la otra extendida al frente.', 'Siéntate hacia atrás y abajo hasta donde puedas controlar, con los brazos al frente para equilibrar.', 'Sube empujando con el pie de apoyo hasta extender del todo.']),
 },
 'sissy_squat': {
  'en': ('Sissy squat', [], ['Lean back as the knees travel forward', 'Hips stay open; it is all knee', 'Hold something for balance until it is smooth'], ['Bending at the hips', 'Dropping too fast'], ['Stand tall, heels raised, holding a post lightly.', 'Bend the knees and lean the torso back as one line, knees travelling forward.', 'Return by driving the knees back over the feet.']),
  'es': ('Sentadilla sissy', [], ['Inclínate hacia atrás mientras las rodillas avanzan', 'La cadera se queda abierta; todo es rodilla', 'Sujétate de algo hasta que salga fluido'], ['Doblar la cadera', 'Bajar demasiado rápido'], ['De pie, talones elevados, sujetando un poste con suavidad.', 'Dobla las rodillas e inclina el torso hacia atrás en una sola línea, con las rodillas avanzando.', 'Vuelve llevando las rodillas de nuevo sobre los pies.']),
 },
 'trap_bar_deadlift': {
  'en': ('Trap bar deadlift', ['hex bar deadlift'], ['Chest up, hips halfway between squat and hinge', 'Push the floor away', 'Lock out by squeezing the glutes'], ['Hips shooting up first', 'Rounding the upper back'], ['Stand inside the bar, feet hip width, grab the handles.', 'Brace, then stand up by pushing the floor away, chest leading.', 'Lower under control by sending the hips back.']),
  'es': ('Peso muerto con barra hexagonal', ['peso muerto trap bar'], ['Pecho arriba, cadera a medio camino entre sentadilla y bisagra', 'Empuja el suelo lejos de ti', 'Bloquea apretando los glúteos'], ['La cadera sube primero', 'Redondear la espalda alta'], ['Párate dentro de la barra, pies al ancho de cadera, toma las asas.', 'Aprieta el tronco y ponte de pie empujando el suelo, con el pecho al frente.', 'Baja con control llevando la cadera hacia atrás.']),
 },
 'sumo_deadlift': {
  'en': ('Sumo deadlift', [], ['Wide stance, toes out, knees over toes', 'Spread the floor as you pull', 'Hips through at the top'], ['Hips too high, turning it into a stiff-leg pull', 'Knees caving'], ['Wide stance, shins close to the bar, grip inside the knees.', 'Brace, then push the knees out and stand, keeping the bar close.', 'Lower by bending the knees and hips together.']),
  'es': ('Peso muerto sumo', [], ['Postura ancha, puntas hacia afuera, rodillas sobre los pies', 'Separa el suelo mientras tiras', 'Lleva la cadera al frente arriba'], ['Cadera demasiado alta, convirtiéndolo en un tirón de piernas rígidas', 'Rodillas hacia adentro'], ['Postura ancha, espinillas cerca de la barra, agarre por dentro de las rodillas.', 'Aprieta el tronco, empuja las rodillas hacia afuera y ponte de pie con la barra pegada.', 'Baja doblando rodillas y cadera a la vez.']),
 },
 'good_morning': {
  'en': ('Good morning', [], ['Soft knees, hinge at the hips', 'Bar stays tight on the back', 'Stop when the hamstrings pull hard'], ['Rounding the lower back', 'Going too heavy'], ['Bar on the upper back, feet hip width, knees soft.', 'Push the hips back and let the torso fold forward until it is near parallel.', 'Drive the hips forward to stand.']),
  'es': ('Buenos días', [], ['Rodillas suaves, bisagra en la cadera', 'La barra se queda firme en la espalda', 'Detente cuando los isquios tiren fuerte'], ['Redondear la zona lumbar', 'Ir demasiado pesado'], ['Barra en la espalda alta, pies al ancho de cadera, rodillas suaves.', 'Lleva la cadera atrás y deja que el torso baje hasta casi paralelo.', 'Empuja la cadera al frente para ponerte de pie.']),
 },
 'cable_pull_through': {
  'en': ('Cable pull-through', [], ['Rope between the legs, hinge back', 'Squeeze the glutes to stand', 'The arms only hold the rope'], ['Pulling with the arms', 'Squatting instead of hinging'], ['Face away from a low pulley, rope between the legs.', 'Step forward, then push the hips back with soft knees.', 'Drive the hips forward and squeeze the glutes at the top.']),
  'es': ('Pull-through en polea', ['tirón entre piernas'], ['Cuerda entre las piernas, bisagra hacia atrás', 'Aprieta los glúteos para ponerte de pie', 'Los brazos solo sujetan la cuerda'], ['Tirar con los brazos', 'Hacer sentadilla en vez de bisagra'], ['De espaldas a la polea baja, con la cuerda entre las piernas.', 'Da un paso adelante y lleva la cadera atrás con las rodillas suaves.', 'Empuja la cadera al frente y aprieta los glúteos arriba.']),
 },
 'single_leg_rdl': {
  'en': ('Single-leg Romanian deadlift', ['single-leg RDL'], ['Hips square, back leg reaching behind', 'Hinge until the hamstring pulls', 'Slow down: balance is the point'], ['Hip opening to the side', 'Rounding the back'], ['Stand on one leg with a dumbbell in the opposite hand.', 'Hinge forward, the free leg reaching back, until the torso is near parallel.', 'Drive the hip forward to stand tall.']),
  'es': ('Peso muerto rumano a una pierna', ['RDL a una pierna'], ['Cadera al frente, la pierna de atrás se estira', 'Bisagra hasta que el isquio tire', 'Ve despacio: el equilibrio es el objetivo'], ['La cadera se abre hacia un lado', 'Redondear la espalda'], ['Párate sobre una pierna con una mancuerna en la mano contraria.', 'Haz bisagra hacia adelante con la pierna libre hacia atrás hasta que el torso esté casi paralelo.', 'Empuja la cadera al frente para ponerte de pie.']),
 },
 'seated_leg_curl': {
  'en': ('Seated leg curl', [], ['Pad just above the heels', 'Curl fully, pause, control the return', 'Hips pinned to the seat'], ['Lifting the hips off the seat', 'Half reps'], ['Sit with the pad above the ankles and the thigh pad locked down.', 'Curl the heels under the seat as far as they go.', 'Return slowly to the start without letting the stack slam.']),
  'es': ('Curl femoral sentado', ['curl de isquios sentado'], ['Almohadilla justo encima de los talones', 'Flexiona del todo, pausa y controla la vuelta', 'Cadera pegada al asiento'], ['Levantar la cadera del asiento', 'Repeticiones a medias'], ['Siéntate con la almohadilla encima de los tobillos y el muslo bloqueado.', 'Lleva los talones debajo del asiento hasta el final.', 'Vuelve despacio sin dejar caer la carga.']),
 },
 'glute_ham_raise': {
  'en': ('Glute-ham raise', ['GHR'], ['Hips extended through the whole rep', 'Lower as slowly as you can', 'Pull yourself up with the hamstrings'], ['Bending at the hips to make it easier', 'Dropping fast'], ['Knees on the pad, feet locked, body in one line.', 'Lower the torso forward under control until the hamstrings are stretched.', 'Curl back up to upright by driving the heels into the plate.']),
  'es': ('Elevación glúteo-isquio', ['GHR'], ['Cadera extendida durante toda la repetición', 'Baja tan lento como puedas', 'Súbete con los isquios'], ['Doblar la cadera para facilitarlo', 'Dejarse caer'], ['Rodillas en la almohadilla, pies fijos, cuerpo en una línea.', 'Baja el torso hacia adelante con control hasta sentir el estiramiento en los isquios.', 'Vuelve arriba empujando los talones contra la placa.']),
 },
 'back_extension': {
  'en': ('Back extension', ['hyperextension'], ['Hinge at the hips, not the spine', 'Stop in line with the legs', 'Squeeze the glutes at the top'], ['Arching past neutral', 'Swinging'], ['Set the pad just below the hip bones and lock the feet.', 'Fold at the hips until the torso hangs down.', 'Raise back to a straight line, no further.']),
  'es': ('Extensión lumbar', ['hiperextensión'], ['Bisagra en la cadera, no en la columna', 'Detente en línea con las piernas', 'Aprieta los glúteos arriba'], ['Arquear más allá de la línea neutra', 'Balancearse'], ['Coloca la almohadilla justo debajo de la cadera y fija los pies.', 'Dobla la cadera hasta que el torso cuelgue.', 'Sube hasta formar una línea recta, no más.']),
 },
 'seated_calf_raise': {
  'en': ('Seated calf raise', [], ['Full stretch at the bottom, pause', 'Rise onto the big toe', 'Slow reps beat heavy ones here'], ['Bouncing', 'Cutting the stretch short'], ['Sit with the pad on the knees and the balls of the feet on the step.', 'Lower the heels as far as they go and pause.', 'Rise as high as you can and squeeze.']),
  'es': ('Elevación de talones sentado', ['gemelo sentado'], ['Estira del todo abajo y pausa', 'Sube sobre el dedo gordo', 'Aquí las repeticiones lentas ganan a las pesadas'], ['Rebotar', 'Acortar el estiramiento'], ['Siéntate con la almohadilla sobre las rodillas y la punta de los pies en el escalón.', 'Baja los talones hasta el final y pausa.', 'Sube lo más alto que puedas y aprieta.']),
 },
 'single_leg_calf_raise': {
  'en': ('Single-leg calf raise', [], ['Heel over the edge, full range', 'Pause at the top and the bottom', 'Hold something for balance, not for help'], ['Bouncing off the stretch', 'Rolling the ankle outward'], ['Stand on one foot on a step, the heel hanging off.', 'Lower the heel until the calf is fully stretched.', 'Rise as high as possible and pause.']),
  'es': ('Elevación de talón a una pierna', [], ['Talón fuera del borde, recorrido completo', 'Pausa arriba y abajo', 'Sujétate para equilibrar, no para ayudarte'], ['Rebotar en el estiramiento', 'Girar el tobillo hacia afuera'], ['Párate con un pie en un escalón, el talón por fuera.', 'Baja el talón hasta estirar la pantorrilla del todo.', 'Sube lo más alto posible y pausa.']),
 },
 'incline_bench_press': {
  'en': ('Incline bench press', ['incline barbell press'], ['Bench at about thirty degrees', 'Bar to the upper chest, elbows under the bar', 'Shoulder blades pinned back'], ['Bench too steep, turning it into a shoulder press', 'Bouncing the bar off the chest'], ['Set the bench to a low incline and grip just wider than the shoulders.', 'Lower the bar to the upper chest with the elbows tucked slightly.', 'Press up and slightly back to lockout.']),
  'es': ('Press de banca inclinado', ['press inclinado con barra'], ['Banco a unos treinta grados', 'Barra al pecho alto, codos bajo la barra', 'Escápulas retraídas'], ['Banco demasiado vertical, convirtiéndolo en press de hombro', 'Rebotar la barra en el pecho'], ['Pon el banco en una inclinación baja y agarra un poco más ancho que los hombros.', 'Baja la barra al pecho alto con los codos ligeramente pegados.', 'Empuja hacia arriba y un poco atrás hasta bloquear.']),
 },
 'close_grip_bench_press': {
  'en': ('Close-grip bench press', [], ['Hands just inside shoulder width', 'Elbows tucked, bar to the lower chest', 'Lock out hard with the triceps'], ['Grip so narrow the wrists hurt', 'Flaring the elbows'], ['Grip the bar about shoulder width, wrists straight.', 'Lower to the lower chest with the elbows close to the body.', 'Press to lockout, focusing on the triceps.']),
  'es': ('Press de banca con agarre cerrado', [], ['Manos justo por dentro del ancho de hombros', 'Codos pegados, barra al pecho bajo', 'Bloquea fuerte con los tríceps'], ['Agarre tan estrecho que duelan las muñecas', 'Abrir los codos'], ['Agarra la barra al ancho de hombros con las muñecas rectas.', 'Baja al pecho bajo con los codos cerca del cuerpo.', 'Empuja hasta bloquear, concentrándote en los tríceps.']),
 },
 'dip': {
  'en': ('Dip', ['parallel bar dip'], ['Lean slightly forward for the chest', 'Lower until the upper arm is parallel', 'Press out and squeeze the chest'], ['Going too deep with the shoulders rolled forward', 'Shrugging the shoulders'], ['Support yourself on the bars, arms locked, feet crossed behind.', 'Bend the elbows and lower with a slight forward lean.', 'Press back to the top without swinging.']),
  'es': ('Fondos en paralelas', ['dips'], ['Inclínate un poco al frente para el pecho', 'Baja hasta que el brazo esté paralelo', 'Empuja y aprieta el pecho'], ['Bajar demasiado con los hombros rotados al frente', 'Encoger los hombros'], ['Sostente en las barras con los brazos bloqueados y los pies cruzados atrás.', 'Dobla los codos y baja con una leve inclinación al frente.', 'Empuja hasta arriba sin balancearte.']),
 },
 'incline_push_up': {
  'en': ('Incline push-up', ['elevated push-up'], ['Hands on a bench or step', 'Body in one line from head to heels', 'Lower the chest to the edge'], ['Hips sagging', 'Elbows flared straight out'], ['Hands on a raised surface, shoulder width, feet back.', 'Lower the chest toward the surface with the elbows at about forty-five degrees.', 'Press back up to full extension.']),
  'es': ('Flexión inclinada', ['flexión en banco'], ['Manos en un banco o escalón', 'Cuerpo en una línea de la cabeza a los talones', 'Baja el pecho hasta el borde'], ['Cadera que cae', 'Codos abiertos del todo'], ['Manos sobre una superficie elevada al ancho de hombros, pies atrás.', 'Baja el pecho hacia la superficie con los codos a unos cuarenta y cinco grados.', 'Empuja hasta extender del todo.']),
 },
 'decline_push_up': {
  'en': ('Decline push-up', ['feet-elevated push-up'], ['Feet on a bench, hands under the shoulders', 'Brace hard; the hips want to sag', 'Chest to the floor, not the nose'], ['Piking the hips', 'Looking up and craning the neck'], ['Feet on a bench, hands on the floor slightly wider than the shoulders.', 'Lower until the chest nearly touches the floor.', 'Press up to full extension without letting the hips drop.']),
  'es': ('Flexión declinada', ['flexión con pies elevados'], ['Pies en un banco, manos bajo los hombros', 'Aprieta fuerte el tronco; la cadera quiere caer', 'Pecho al suelo, no la nariz'], ['Levantar la cadera en pico', 'Mirar arriba y forzar el cuello'], ['Pies en un banco, manos en el suelo un poco más anchas que los hombros.', 'Baja hasta que el pecho casi toque el suelo.', 'Empuja hasta extender sin dejar caer la cadera.']),
 },
 'diamond_push_up': {
  'en': ('Diamond push-up', ['close-grip push-up'], ['Thumbs and index fingers make a diamond', 'Elbows brush the ribs', 'Lock out and squeeze the triceps'], ['Flaring the elbows', 'Hips sagging'], ['Hands together under the chest, body in one line.', 'Lower with the elbows close to the body until the chest meets the hands.', 'Press back up to a full lockout.']),
  'es': ('Flexión diamante', ['flexión con manos juntas'], ['Pulgares e índices forman un diamante', 'Los codos rozan las costillas', 'Bloquea y aprieta los tríceps'], ['Abrir los codos', 'Cadera que cae'], ['Manos juntas bajo el pecho, cuerpo en una línea.', 'Baja con los codos pegados hasta que el pecho toque las manos.', 'Empuja hasta bloquear del todo.']),
 },
 'machine_fly': {
  'en': ('Machine fly', ['pec deck'], ['Elbows slightly bent and fixed', 'Squeeze the pads together in front of the chest', 'Open slowly to a comfortable stretch'], ['Going too heavy and using the shoulders', 'Opening past the shoulder line'], ['Sit with the handles level with the mid chest.', 'Bring the handles together in a wide arc and squeeze.', 'Open slowly until a stretch across the chest.']),
  'es': ('Aperturas en máquina', ['pec deck', 'contractora'], ['Codos un poco doblados y fijos', 'Junta las almohadillas frente al pecho y aprieta', 'Abre despacio hasta un estiramiento cómodo'], ['Ir muy pesado y usar los hombros', 'Abrir más allá de la línea de los hombros'], ['Siéntate con las asas a la altura del pecho medio.', 'Junta las asas en un arco amplio y aprieta.', 'Abre despacio hasta sentir el estiramiento en el pecho.']),
 },
 'arnold_press': {
  'en': ('Arnold press', [], ['Start with the palms facing you', 'Rotate as you press', 'Finish with the dumbbells over the shoulders'], ['Arching the lower back', 'Rushing the rotation'], ['Sit tall with the dumbbells at shoulder height, palms toward you.', 'Press up while rotating the palms to face forward.', 'Lower and rotate back to the start under control.']),
  'es': ('Press Arnold', [], ['Empieza con las palmas hacia ti', 'Rota mientras empujas', 'Termina con las mancuernas sobre los hombros'], ['Arquear la zona lumbar', 'Apurar la rotación'], ['Siéntate erguido con las mancuernas a la altura de los hombros y las palmas hacia ti.', 'Empuja hacia arriba rotando las palmas al frente.', 'Baja rotando de vuelta con control.']),
 },
 'landmine_press': {
  'en': ('Landmine press', [], ['Bar end at the shoulder, other hand free', 'Press up and forward along the bar', 'Ribs down through the whole rep'], ['Arching to get the bar up', 'Turning the torso away'], ['Stand facing the bar end, held at the shoulder with one hand.', 'Press the bar up and away until the arm is straight.', 'Lower back to the shoulder under control.']),
  'es': ('Press landmine', ['press con barra anclada'], ['Extremo de la barra en el hombro, la otra mano libre', 'Empuja hacia arriba y al frente siguiendo la barra', 'Costillas abajo durante toda la repetición'], ['Arquearse para subir la barra', 'Girar el torso'], ['De frente al extremo de la barra, sujeto en el hombro con una mano.', 'Empuja la barra arriba y al frente hasta extender el brazo.', 'Baja de vuelta al hombro con control.']),
 },
 'cable_lateral_raise': {
  'en': ('Cable lateral raise', [], ['Cable behind the body, slight lean away', 'Lead with the elbow', 'Stop at shoulder height'], ['Shrugging', 'Swinging the weight up'], ['Stand side-on to a low pulley, handle in the far hand.', 'Raise the arm out to the side to shoulder height.', 'Lower slowly against the cable.']),
  'es': ('Elevación lateral en polea', [], ['Cable detrás del cuerpo, leve inclinación hacia afuera', 'Lidera con el codo', 'Detente a la altura del hombro'], ['Encoger los hombros', 'Impulsar el peso'], ['De lado a una polea baja, con el asa en la mano más lejana.', 'Eleva el brazo hacia el lado hasta la altura del hombro.', 'Baja despacio contra el cable.']),
 },
 'band_pull_apart': {
  'en': ('Band pull-apart', [], ['Arms straight, band at chest height', 'Pull until it touches the chest', 'Squeeze the shoulder blades'], ['Shrugging the shoulders', 'Bending the elbows'], ['Hold a light band in front of you at shoulder width.', 'Pull the hands apart until the band meets the chest.', 'Return slowly, resisting the band.']),
  'es': ('Apertura con banda', ['band pull-apart'], ['Brazos rectos, banda a la altura del pecho', 'Tira hasta que toque el pecho', 'Aprieta las escápulas'], ['Encoger los hombros', 'Doblar los codos'], ['Sujeta una banda ligera al frente al ancho de hombros.', 'Separa las manos hasta que la banda toque el pecho.', 'Vuelve despacio resistiendo la banda.']),
 },
 'y_raise': {
  'en': ('Y raise', ['prone Y raise'], ['Thumbs up, arms in a Y', 'Lift from the shoulder blades', 'Light weight; it is a small muscle'], ['Using momentum', 'Shrugging into the neck'], ['Lie chest-down on an incline bench with light dumbbells hanging.', 'Raise the arms up and out into a Y shape, thumbs up.', 'Lower slowly to the start.']),
  'es': ('Elevación en Y', [], ['Pulgares arriba, brazos en Y', 'Eleva desde las escápulas', 'Peso ligero; es un músculo pequeño'], ['Usar impulso', 'Encoger los hombros hacia el cuello'], ['Túmbate boca abajo en un banco inclinado con mancuernas ligeras colgando.', 'Eleva los brazos arriba y afuera formando una Y, con los pulgares arriba.', 'Baja despacio al inicio.']),
 },
 'chin_up': {
  'en': ('Chin-up', ['underhand pull-up'], ['Palms toward you, shoulder width', 'Pull the elbows to the ribs', 'Chin over the bar, then lower slowly'], ['Kipping', 'Half reps'], ['Hang from the bar with an underhand grip, arms straight.', 'Pull up until the chin clears the bar.', 'Lower under control to a full hang.']),
  'es': ('Dominada supina', ['chin-up', 'dominada con agarre supino'], ['Palmas hacia ti, al ancho de hombros', 'Lleva los codos a las costillas', 'Barbilla sobre la barra y baja despacio'], ['Balancearse', 'Repeticiones a medias'], ['Cuélgate de la barra con agarre supino y los brazos rectos.', 'Sube hasta que la barbilla pase la barra.', 'Baja con control hasta colgar del todo.']),
 },
 'assisted_pull_up': {
  'en': ('Assisted pull-up', ['machine pull-up'], ['Set the help so you finish the set just short of failure', 'Pull the elbows down and back', 'Full hang at the bottom'], ['So much assistance it does nothing', 'Shrugging at the top'], ['Kneel on the pad with a grip just wider than the shoulders.', 'Pull up until the chin reaches the bar.', 'Lower slowly to straight arms.']),
  'es': ('Dominada asistida', ['dominada en máquina'], ['Ajusta la ayuda para terminar la serie justo antes del fallo', 'Lleva los codos abajo y atrás', 'Cuelga del todo abajo'], ['Tanta ayuda que no hace nada', 'Encoger los hombros arriba'], ['Arrodíllate en la almohadilla con el agarre un poco más ancho que los hombros.', 'Sube hasta que la barbilla llegue a la barra.', 'Baja despacio hasta extender los brazos.']),
 },
 'pendlay_row': {
  'en': ('Pendlay row', ['dead-stop row'], ['Bar rests on the floor between reps', 'Torso parallel, explode to the lower chest', 'Reset the brace every rep'], ['Lifting the torso to finish the pull', 'Bouncing the bar'], ['Stand over the bar, torso parallel to the floor, grip outside the knees.', 'Row the bar hard to the lower chest.', 'Return it to the floor and reset before the next rep.']),
  'es': ('Remo Pendlay', ['remo desde el suelo'], ['La barra descansa en el suelo entre repeticiones', 'Torso paralelo, explota hacia el pecho bajo', 'Aprieta el tronco en cada repetición'], ['Levantar el torso para terminar el tirón', 'Rebotar la barra'], ['Sobre la barra, torso paralelo al suelo, agarre por fuera de las rodillas.', 'Rema la barra con fuerza hasta el pecho bajo.', 'Devuélvela al suelo y reinicia antes de la siguiente.']),
 },
 't_bar_row': {
  'en': ('T-bar row', [], ['Chest up, hinge set, knees soft', 'Pull to the sternum', 'Lower until the arms are straight'], ['Rounding the back to move more', 'Jerking the weight'], ['Straddle the bar, grip the handle, hinge to about forty-five degrees.', 'Row the handle to the chest, elbows close.', 'Lower under control to full stretch.']),
  'es': ('Remo en T', ['remo con barra en T'], ['Pecho arriba, bisagra fija, rodillas suaves', 'Tira hacia el esternón', 'Baja hasta extender los brazos'], ['Redondear la espalda para mover más', 'Tirar con impulso'], ['A horcajadas sobre la barra, toma el asa y haz bisagra hasta unos cuarenta y cinco grados.', 'Rema el asa hacia el pecho con los codos cerca.', 'Baja con control hasta estirar del todo.']),
 },
 'suspension_row': {
  'en': ('Suspension row', ['TRX row', 'ring row'], ['Body in one line, heels planted', 'Pull the chest to the handles', 'Walk the feet forward to make it harder'], ['Hips sagging', 'Shrugging at the top'], ['Hold the handles, lean back with straight arms and a straight body.', 'Row until the chest reaches the handles.', 'Lower slowly to straight arms.']),
  'es': ('Remo en suspensión', ['remo en TRX', 'remo en anillas'], ['Cuerpo en una línea, talones apoyados', 'Lleva el pecho a las asas', 'Adelanta los pies para hacerlo más difícil'], ['Cadera que cae', 'Encoger los hombros arriba'], ['Toma las asas, inclínate atrás con los brazos y el cuerpo rectos.', 'Rema hasta que el pecho llegue a las asas.', 'Baja despacio hasta extender los brazos.']),
 },
 'straight_arm_pulldown': {
  'en': ('Straight-arm pulldown', ['lat pullover'], ['Arms almost straight the whole way', 'Pull the bar to the thighs with the lats', 'Ribs down, no arching'], ['Bending the elbows into a pushdown', 'Leaning back'], ['Stand facing a high pulley with a straight bar, arms extended.', 'Pull the bar down in an arc to the thighs.', 'Return slowly to shoulder height.']),
  'es': ('Jalón con brazos rectos', ['pullover en polea'], ['Brazos casi rectos todo el recorrido', 'Lleva la barra a los muslos con los dorsales', 'Costillas abajo, sin arquear'], ['Doblar los codos y convertirlo en extensión', 'Inclinarse hacia atrás'], ['De frente a una polea alta con barra recta y los brazos extendidos.', 'Baja la barra en arco hasta los muslos.', 'Vuelve despacio a la altura de los hombros.']),
 },
 'bird_dog': {
  'en': ('Bird dog', [], ['Reach the opposite arm and leg long', 'Hips level, nothing else moves', 'Slow out, slow back'], ['Arching the lower back', 'Rushing'], ['On all fours, hands under the shoulders and knees under the hips.', 'Extend one arm and the opposite leg until they are in line with the torso.', 'Hold, then return and switch sides.']),
  'es': ('Perro de caza', ['bird dog'], ['Estira el brazo y la pierna contrarios', 'Cadera nivelada, nada más se mueve', 'Sal despacio y vuelve despacio'], ['Arquear la zona lumbar', 'Apurar'], ['En cuatro apoyos, manos bajo los hombros y rodillas bajo la cadera.', 'Extiende un brazo y la pierna contraria hasta alinearlos con el torso.', 'Mantén, vuelve y cambia de lado.']),
 },
 'preacher_curl': {
  'en': ('Preacher curl', ['EZ-bar preacher curl'], ['Armpits on top of the pad', 'Lower until the arms are nearly straight', 'Curl without lifting the elbows'], ['Stopping short at the bottom', 'Swinging the torso'], ['Sit with the upper arms flat on the pad and the bar in your hands.', 'Curl the bar up until the forearms are near vertical.', 'Lower slowly to nearly straight arms.']),
  'es': ('Curl en banco Scott', ['curl predicador'], ['Axilas sobre la almohadilla', 'Baja hasta casi extender los brazos', 'Flexiona sin levantar los codos'], ['Quedarse corto abajo', 'Balancear el torso'], ['Siéntate con los brazos apoyados en la almohadilla y la barra en las manos.', 'Flexiona hasta que los antebrazos estén casi verticales.', 'Baja despacio hasta casi extender los brazos.']),
 },
 'incline_dumbbell_curl': {
  'en': ('Incline dumbbell curl', [], ['Let the arms hang behind the body', 'Curl without the elbows drifting forward', 'Full stretch at the bottom'], ['Sitting too upright', 'Swinging the dumbbells'], ['Sit back on an incline bench with dumbbells hanging at the sides.', 'Curl both dumbbells up, elbows still.', 'Lower slowly to a full stretch.']),
  'es': ('Curl inclinado con mancuernas', [], ['Deja que los brazos cuelguen detrás del cuerpo', 'Flexiona sin que los codos avancen', 'Estira del todo abajo'], ['Sentarse demasiado erguido', 'Balancear las mancuernas'], ['Recuéstate en un banco inclinado con las mancuernas colgando a los lados.', 'Flexiona ambas mancuernas con los codos quietos.', 'Baja despacio hasta estirar del todo.']),
 },
 'concentration_curl': {
  'en': ('Concentration curl', [], ['Elbow braced on the inner thigh', 'Curl toward the shoulder', 'Squeeze at the top for a second'], ['Lifting the elbow off the thigh', 'Rocking the body'], ['Sit, feet wide, one elbow on the inner thigh with a dumbbell hanging.', 'Curl the dumbbell toward the shoulder.', 'Lower slowly to a straight arm.']),
  'es': ('Curl de concentración', [], ['Codo apoyado en la cara interna del muslo', 'Flexiona hacia el hombro', 'Aprieta un segundo arriba'], ['Despegar el codo del muslo', 'Mecer el cuerpo'], ['Sentado con los pies separados, un codo en la cara interna del muslo con la mancuerna colgando.', 'Flexiona la mancuerna hacia el hombro.', 'Baja despacio hasta estirar el brazo.']),
 },
 'cable_overhead_triceps_extension': {
  'en': ('Cable overhead triceps extension', ['rope overhead extension'], ['Face away from the pulley, rope overhead', 'Elbows stay by the ears', 'Extend fully and spread the rope'], ['Elbows flaring wide', 'Arching the lower back'], ['Face away from a high pulley holding the rope overhead.', 'Lower the rope behind the head by bending the elbows.', 'Extend the arms to lockout, spreading the rope.']),
  'es': ('Extensión de tríceps sobre la cabeza en polea', ['extensión con cuerda sobre la cabeza'], ['De espaldas a la polea, cuerda sobre la cabeza', 'Los codos se quedan junto a las orejas', 'Extiende del todo y separa la cuerda'], ['Codos que se abren', 'Arquear la zona lumbar'], ['De espaldas a una polea alta con la cuerda sobre la cabeza.', 'Baja la cuerda detrás de la cabeza doblando los codos.', 'Extiende los brazos hasta bloquear separando la cuerda.']),
 },
 'triceps_kickback': {
  'en': ('Triceps kickback', [], ['Upper arm parallel to the floor and still', 'Extend until the arm is straight', 'Light weight, strict form'], ['Dropping the elbow', 'Swinging'], ['Hinge forward with one hand on a bench, the upper arm parallel to the floor.', 'Extend the elbow until the arm is straight.', 'Return slowly without moving the upper arm.']),
  'es': ('Patada de tríceps', ['kickback de tríceps'], ['Brazo paralelo al suelo y quieto', 'Extiende hasta estirar el brazo', 'Peso ligero, técnica estricta'], ['Dejar caer el codo', 'Balancear'], ['Haz bisagra con una mano en un banco y el brazo paralelo al suelo.', 'Extiende el codo hasta estirar el brazo.', 'Vuelve despacio sin mover el brazo.']),
 },
 'ab_wheel_rollout': {
  'en': ('Ab wheel rollout', ['rollout'], ['Tuck the pelvis before you roll', 'Go only as far as the back stays flat', 'Pull back with the abs, not the arms'], ['Sagging at the hips', 'Rolling out too far too soon'], ['Kneel with the wheel under the shoulders.', 'Roll forward slowly, keeping the trunk braced.', 'Pull the wheel back to the knees.']),
  'es': ('Rueda abdominal', ['rollout'], ['Mete la pelvis antes de rodar', 'Avanza solo hasta donde la espalda se quede plana', 'Vuelve con el abdomen, no con los brazos'], ['Cadera que cae', 'Rodar demasiado lejos demasiado pronto'], ['De rodillas con la rueda bajo los hombros.', 'Rueda hacia adelante despacio con el tronco apretado.', 'Trae la rueda de vuelta a las rodillas.']),
 },
 'hanging_leg_raise': {
  'en': ('Hanging leg raise', [], ['Straight legs, tilt the pelvis up', 'Toes to the bar if you can', 'Lower slowly, no swing'], ['Swinging', 'Using the hip flexors only'], ['Hang from a bar with a firm grip and straight legs.', 'Raise the legs, curling the pelvis up at the top.', 'Lower slowly under control.']),
  'es': ('Elevación de piernas colgado', [], ['Piernas rectas, inclina la pelvis hacia arriba', 'Pies a la barra si puedes', 'Baja despacio, sin balanceo'], ['Balancearse', 'Usar solo los flexores de cadera'], ['Cuélgate de una barra con agarre firme y piernas rectas.', 'Eleva las piernas curvando la pelvis arriba al final.', 'Baja despacio con control.']),
 },
 'copenhagen_plank': {
  'en': ('Copenhagen plank', ['adductor plank'], ['Top leg on the bench, body in one line', 'Squeeze the inner thigh to hold', 'Bend the bottom knee to make it easier'], ['Hips dropping', 'Holding the breath'], ['Lie on your side with the top foot on a bench and the elbow under the shoulder.', 'Lift the hips until the body is one line.', 'Hold, breathing, then switch sides.']),
  'es': ('Plancha Copenhague', ['plancha de aductores'], ['Pierna de arriba en el banco, cuerpo en una línea', 'Aprieta la cara interna del muslo para sostener', 'Dobla la rodilla de abajo para facilitarlo'], ['Cadera que cae', 'Aguantar la respiración'], ['De lado con el pie de arriba en un banco y el codo bajo el hombro.', 'Eleva la cadera hasta que el cuerpo sea una línea.', 'Mantén respirando y cambia de lado.']),
 },
 'suitcase_carry': {
  'en': ('Suitcase carry', ['one-hand carry'], ['One heavy weight, stay perfectly upright', 'Do not lean away from the load', 'Short quick steps'], ['Leaning to the free side', 'Shrugging the loaded shoulder'], ['Pick up a heavy dumbbell in one hand and stand tall.', 'Walk the distance with the shoulders level.', 'Switch hands and return.']),
  'es': ('Paseo con maleta', ['paseo a una mano'], ['Un peso pesado, quédate perfectamente erguido', 'No te inclines hacia el lado contrario', 'Pasos cortos y rápidos'], ['Inclinarse hacia el lado libre', 'Encoger el hombro cargado'], ['Levanta una mancuerna pesada con una mano y párate erguido.', 'Camina la distancia con los hombros nivelados.', 'Cambia de mano y vuelve.']),
 },
 'russian_twist': {
  'en': ('Russian twist', [], ['Lean back, chest up', 'Rotate from the ribcage, not the arms', 'Slow and controlled'], ['Rounding the back', 'Only moving the hands'], ['Sit with the knees bent and lean back until the abs engage.', 'Rotate the torso to one side, then the other.', 'Keep the feet down until it is easy.']),
  'es': ('Giro ruso', [], ['Inclínate atrás con el pecho arriba', 'Rota desde las costillas, no con los brazos', 'Lento y controlado'], ['Redondear la espalda', 'Mover solo las manos'], ['Siéntate con las rodillas dobladas e inclínate atrás hasta que el abdomen trabaje.', 'Rota el torso hacia un lado y luego al otro.', 'Mantén los pies abajo hasta que sea fácil.']),
 },
 'reverse_crunch': {
  'en': ('Reverse crunch', [], ['Curl the hips off the floor', 'Lower the legs slowly', 'Lower back stays down'], ['Swinging the legs', 'Arching the back as the legs lower'], ['Lie on your back with the knees bent over the hips.', 'Curl the pelvis up, lifting the hips off the floor.', 'Lower slowly without arching the back.']),
  'es': ('Crunch inverso', ['abdominal inverso'], ['Despega la cadera del suelo curvándola', 'Baja las piernas despacio', 'La zona lumbar se queda abajo'], ['Balancear las piernas', 'Arquear la espalda al bajar las piernas'], ['Boca arriba con las rodillas dobladas sobre la cadera.', 'Curva la pelvis arriba despegando la cadera del suelo.', 'Baja despacio sin arquear la espalda.']),
 },
}

for locale in ('en', 'es'):
    path = pathlib.Path(f'messages/{locale}.json')
    data = json.loads(path.read_text())
    ex = data['exercises']
    for ident, both in X.items():
        name, aliases, cues, mistakes, steps = both[locale]
        entry = {'name': name, 'aliases': ', '.join(aliases), 'cue1': cues[0], 'cue2': cues[1], 'cue3': cues[2], 'mistake1': mistakes[0], 'mistake2': mistakes[1], 'step1': steps[0], 'step2': steps[1], 'step3': steps[2]}
        ex[ident] = entry
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print('wrote', len(X), 'exercises')
