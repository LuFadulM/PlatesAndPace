"""One-off: extend the original 86 exercises with aliases, a third cue and
three execution steps, in both languages. Names, the first two cues and the
mistakes already in messages/{en,es}.json are kept as they are. The JSON files
are the source of truth once written."""
import json, pathlib

# id: {en: (aliases, cue3, steps[3]), es: (aliases, cue3, steps[3])}
X = {
 'back_squat': {
  'en': (['barbell squat', 'squat'], 'Sit between the hips, not onto the knees', ['Bar on the upper back, feet shoulder width, toes slightly out.', 'Brace, then sit down between the hips until the thighs pass parallel.', 'Drive the floor away and stand tall, knees tracking over the toes.']),
  'es': (['sentadilla trasera', 'sentadilla'], 'Siéntate entre las caderas, no sobre las rodillas', ['Barra en la espalda alta, pies al ancho de hombros, puntas un poco hacia afuera.', 'Aprieta el tronco y baja entre las caderas hasta pasar el paralelo.', 'Empuja el piso y ponte de pie con las rodillas siguiendo la línea de los pies.']),
 },
 'front_squat': {
  'en': (['clean-grip squat'], 'Elbows high or the bar rolls forward', ['Bar on the front of the shoulders, elbows high, fingertips under it.', 'Sit straight down with the torso upright until the thighs pass parallel.', 'Drive up keeping the elbows up the whole way.']),
  'es': (['sentadilla frontal con barra'], 'Codos altos o la barra se va hacia adelante', ['Barra al frente de los hombros, codos altos, la punta de los dedos debajo.', 'Baja recto con el torso erguido hasta pasar el paralelo.', 'Sube manteniendo los codos arriba todo el recorrido.']),
 },
 'goblet_squat': {
  'en': (['dumbbell squat', 'kettlebell squat'], 'Elbows inside the knees at the bottom', ['Hold one dumbbell vertically against the chest, feet shoulder width.', 'Sit down between the heels, chest up, until the elbows meet the knees.', 'Push the floor away to stand.']),
  'es': (['sentadilla con mancuerna', 'sentadilla con kettlebell'], 'Codos por dentro de las rodillas en el fondo', ['Sostén una mancuerna vertical contra el pecho, pies al ancho de hombros.', 'Baja entre los talones con el pecho arriba hasta que los codos toquen las rodillas.', 'Empuja el piso para ponerte de pie.']),
 },
 'leg_press': {
  'en': (['sled press', 'machine squat'], 'Lower back stays glued to the pad', ['Feet shoulder width in the middle of the platform, back flat on the pad.', 'Lower the sled until the knees are near ninety degrees without the hips rolling.', 'Press through the whole foot; stop just short of locking the knees.']),
  'es': (['prensa de piernas', 'prensa inclinada'], 'La zona lumbar se queda pegada al respaldo', ['Pies al ancho de hombros en el centro de la plataforma, espalda plana en el respaldo.', 'Baja la plataforma hasta que las rodillas lleguen a unos noventa grados sin que la cadera se despegue.', 'Empuja con todo el pie; detente antes de bloquear las rodillas.']),
 },
 'hack_squat': {
  'en': (['machine hack squat'], 'Push through the whole foot', ['Shoulders under the pads, feet mid platform, back flat.', 'Lower under control until the thighs pass parallel.', 'Drive up without locking the knees hard at the top.']),
  'es': (['sentadilla hack en máquina'], 'Empuja con todo el pie', ['Hombros bajo las almohadillas, pies al centro de la plataforma, espalda plana.', 'Baja con control hasta pasar el paralelo.', 'Sube sin bloquear las rodillas con fuerza arriba.']),
 },
 'bulgarian_split_squat': {
  'en': (['rear-foot-elevated split squat', 'RFESS'], 'Most of the weight stays on the front foot', ['Back foot on a bench, front foot a long stride ahead.', 'Lower straight down until the back knee is near the floor.', 'Drive up through the front foot without bouncing off the back leg.']),
  'es': (['sentadilla búlgara', 'zancada con pie elevado'], 'Casi todo el peso va en el pie delantero', ['Pie trasero sobre un banco, el delantero un paso largo adelante.', 'Baja recto hasta que la rodilla trasera casi toque el suelo.', 'Sube empujando con el pie delantero sin rebotar en la pierna de atrás.']),
 },
 'walking_lunge': {
  'en': (['lunges'], 'Step long enough that the front shin stays vertical', ['Stand tall with dumbbells at the sides.', 'Step forward and lower until both knees are near ninety degrees.', 'Drive through the front foot and step straight into the next rep.']),
  'es': (['zancadas caminando', 'estocadas'], 'Da un paso lo bastante largo para que la espinilla siga vertical', ['De pie con las mancuernas a los lados.', 'Da un paso adelante y baja hasta que ambas rodillas lleguen a unos noventa grados.', 'Empuja con el pie delantero y pasa directo a la siguiente repetición.']),
 },
 'step_up': {
  'en': (['box step-up'], 'Put the whole foot on the box', ['Stand in front of a knee-high box or bench.', 'Place the whole foot on it and stand up without pushing off the floor leg.', 'Lower slowly, controlling the descent with the top leg.']),
  'es': (['subida al cajón'], 'Apoya todo el pie en el cajón', ['Párate frente a un cajón o banco a la altura de la rodilla.', 'Apoya todo el pie y sube sin impulsarte con la pierna del suelo.', 'Baja despacio controlando con la pierna de arriba.']),
 },
 'bodyweight_squat': {
  'en': (['air squat'], 'Reach the arms forward for balance', ['Feet shoulder width, toes slightly out, arms in front.', 'Sit down between the hips as deep as you can control.', 'Stand back up through the whole foot.']),
  'es': (['sentadilla sin peso', 'sentadilla al aire'], 'Estira los brazos al frente para equilibrar', ['Pies al ancho de hombros, puntas un poco hacia afuera, brazos al frente.', 'Baja entre las caderas tan profundo como puedas controlar.', 'Vuelve arriba empujando con todo el pie.']),
 },
 'reverse_lunge': {
  'en': (['backward lunge'], 'Push through the front heel to return', ['Stand tall, feet hip width.', 'Step one foot back and lower the back knee toward the floor.', 'Drive through the front foot to bring the feet together.']),
  'es': (['zancada atrás', 'estocada inversa'], 'Empuja con el talón delantero para volver', ['De pie con los pies al ancho de cadera.', 'Da un paso atrás y baja la rodilla trasera hacia el suelo.', 'Empuja con el pie delantero para juntar los pies.']),
 },
 'leg_extension': {
  'en': (['quad extension', 'knee extension'], 'Pause at the top and squeeze', ['Sit with the pad on the shins and the knees in line with the pivot.', 'Extend the legs until they are straight and pause.', 'Lower slowly without letting the stack touch down.']),
  'es': (['extensión de cuádriceps', 'extensión de rodilla'], 'Pausa arriba y aprieta', ['Siéntate con la almohadilla en las espinillas y las rodillas alineadas con el eje.', 'Extiende las piernas hasta estirarlas y pausa.', 'Baja despacio sin dejar que la carga toque.']),
 },
 'conventional_deadlift': {
  'en': (['deadlift', 'barbell deadlift'], 'Bar stays in contact with the legs', ['Feet hip width, bar over the midfoot, grip just outside the legs.', 'Brace, pull the slack out and stand up with the bar dragging the shins.', 'Lock out by squeezing the glutes, then hinge back down.']),
  'es': (['peso muerto', 'peso muerto con barra'], 'La barra va pegada a las piernas', ['Pies al ancho de cadera, barra sobre el medio del pie, agarre por fuera de las piernas.', 'Aprieta el tronco, tensa la barra y ponte de pie rozando las espinillas.', 'Bloquea apretando los glúteos y baja con bisagra.']),
 },
 'romanian_deadlift': {
  'en': (['RDL', 'stiff-leg deadlift'], 'Stop when the hamstrings pull, not when the bar reaches the floor', ['Stand tall with the bar at the hips, knees soft.', 'Push the hips back and slide the bar down the thighs.', 'Drive the hips forward to stand, squeezing the glutes.']),
  'es': (['RDL', 'peso muerto piernas rígidas'], 'Detente cuando los isquios tiren, no cuando la barra llegue al suelo', ['De pie con la barra en la cadera y las rodillas suaves.', 'Lleva la cadera atrás y desliza la barra por los muslos.', 'Empuja la cadera al frente para subir apretando los glúteos.']),
 },
 'dumbbell_rdl': {
  'en': (['dumbbell Romanian deadlift'], 'Dumbbells slide down the front of the legs', ['Stand tall with a dumbbell in each hand at the thighs.', 'Push the hips back, dumbbells tracking down the legs, back flat.', 'Drive the hips forward to stand.']),
  'es': (['peso muerto rumano con mancuernas'], 'Las mancuernas bajan pegadas a las piernas', ['De pie con una mancuerna en cada mano a la altura de los muslos.', 'Lleva la cadera atrás con las mancuernas pegadas a las piernas y la espalda plana.', 'Empuja la cadera al frente para subir.']),
 },
 'leg_curl': {
  'en': (['lying leg curl', 'hamstring curl'], 'Hips stay down on the pad', ['Lie face down with the pad above the heels.', 'Curl the heels toward the glutes as far as they go.', 'Lower slowly to the start.']),
  'es': (['curl femoral tumbado', 'curl de isquios'], 'La cadera se queda pegada a la almohadilla', ['Boca abajo con la almohadilla encima de los talones.', 'Lleva los talones hacia los glúteos hasta el final.', 'Baja despacio al inicio.']),
 },
 'nordic_curl': {
  'en': (['Nordic hamstring curl'], 'Hips open the whole way down', ['Kneel with the ankles anchored, hips extended.', 'Lower the torso forward as slowly as you can, hands ready to catch.', 'Push off lightly and pull yourself back up.']),
  'es': (['curl nórdico'], 'Cadera abierta durante toda la bajada', ['De rodillas con los tobillos fijos y la cadera extendida.', 'Baja el torso hacia adelante tan lento como puedas, con las manos listas para frenar.', 'Impúlsate ligeramente y súbete con los isquios.']),
 },
 'hip_thrust': {
  'en': (['barbell hip thrust', 'glute bridge with bar'], 'Chin tucked, ribs down at the top', ['Upper back on a bench, bar over the hips, feet flat.', 'Drive the hips up until the body is a line from shoulders to knees.', 'Lower under control without resting at the bottom.']),
  'es': (['empuje de cadera con barra', 'elevación de cadera'], 'Barbilla recogida y costillas abajo en la parte alta', ['Espalda alta en un banco, barra sobre la cadera, pies planos.', 'Empuja la cadera arriba hasta formar una línea de hombros a rodillas.', 'Baja con control sin descansar abajo.']),
 },
 'dumbbell_hip_thrust': {
  'en': (['dumbbell glute bridge'], 'Push through the heels', ['Upper back on a bench, a dumbbell across the hips.', 'Drive the hips up until the thighs are level with the torso.', 'Lower slowly and repeat.']),
  'es': (['empuje de cadera con mancuerna'], 'Empuja con los talones', ['Espalda alta en un banco, una mancuerna sobre la cadera.', 'Empuja la cadera arriba hasta que los muslos queden en línea con el torso.', 'Baja despacio y repite.']),
 },
 'glute_bridge': {
  'en': (['floor bridge'], 'Squeeze the glutes, not the lower back', ['Lie on your back with the knees bent and feet flat.', 'Drive the hips up until the body is a straight line.', 'Pause, then lower slowly.']),
  'es': (['puente de glúteo', 'puente en el suelo'], 'Aprieta los glúteos, no la zona lumbar', ['Boca arriba con las rodillas dobladas y los pies planos.', 'Empuja la cadera arriba hasta formar una línea recta.', 'Pausa y baja despacio.']),
 },
 'cable_kickback': {
  'en': (['glute kickback'], 'Squeeze at the top, no arch', ['Attach the cuff to the ankle and hold the frame.', 'Kick the leg straight back by squeezing the glute.', 'Return slowly without swinging.']),
  'es': (['patada de glúteo en polea'], 'Aprieta arriba, sin arquear', ['Pon la tobillera y sujeta la estructura.', 'Lleva la pierna recta hacia atrás apretando el glúteo.', 'Vuelve despacio sin balancear.']),
 },
 'hip_abduction': {
  'en': (['abductor machine', 'seated abduction'], 'Lean forward slightly to hit the upper glute', ['Sit with the pads outside the knees.', 'Push the knees apart as far as they go and pause.', 'Return slowly to the start.']),
  'es': (['máquina de abductores', 'abducción sentado'], 'Inclínate un poco al frente para trabajar el glúteo alto', ['Siéntate con las almohadillas por fuera de las rodillas.', 'Separa las rodillas hasta el final y pausa.', 'Vuelve despacio al inicio.']),
 },
 'single_leg_glute_bridge': {
  'en': (['one-leg bridge'], 'Hips level, no tilting', ['Lie on your back, one foot flat, the other leg raised.', 'Drive the hips up through the planted heel.', 'Lower slowly and keep the hips level throughout.']),
  'es': (['puente a una pierna'], 'Cadera nivelada, sin inclinarse', ['Boca arriba con un pie plano y la otra pierna elevada.', 'Empuja la cadera arriba con el talón apoyado.', 'Baja despacio manteniendo la cadera nivelada.']),
 },
 'standing_calf_raise': {
  'en': (['calf raise machine'], 'Full stretch, pause, full squeeze', ['Balls of the feet on the step, shoulders under the pads.', 'Lower the heels until the calves are fully stretched.', 'Rise as high as possible and pause.']),
  'es': (['elevación de talones de pie', 'gemelo de pie'], 'Estira del todo, pausa, aprieta del todo', ['Punta de los pies en el escalón, hombros bajo las almohadillas.', 'Baja los talones hasta estirar las pantorrillas del todo.', 'Sube lo más alto posible y pausa.']),
 },
 'dumbbell_calf_raise': {
  'en': (['loaded calf raise'], 'Hold the top for a second', ['Stand on a step holding a dumbbell, heels hanging off.', 'Lower the heels until you feel a full stretch.', 'Rise onto the big toe and pause.']),
  'es': (['elevación de talones con mancuerna'], 'Aguanta arriba un segundo', ['Párate en un escalón con una mancuerna, talones por fuera.', 'Baja los talones hasta sentir el estiramiento completo.', 'Sube sobre el dedo gordo y pausa.']),
 },
 'bodyweight_calf_raise': {
  'en': (['standing calf raise'], 'Slow reps, full range', ['Stand with the balls of the feet on a step or the floor.', 'Rise as high as you can and pause.', 'Lower slowly to a full stretch.']),
  'es': (['elevación de talones sin peso'], 'Repeticiones lentas y recorrido completo', ['De pie con la punta de los pies en un escalón o en el suelo.', 'Sube lo más alto que puedas y pausa.', 'Baja despacio hasta estirar del todo.']),
 },
 'bench_press': {
  'en': (['barbell bench press', 'flat bench'], 'Feet planted, shoulder blades pinned', ['Lie with the eyes under the bar, shoulder blades pulled back and down.', 'Lower the bar to the lower chest with the elbows at about forty-five degrees.', 'Press back up to lockout over the shoulders.']),
  'es': (['press de banca con barra', 'press plano'], 'Pies firmes y escápulas retraídas', ['Túmbate con los ojos bajo la barra y las escápulas atrás y abajo.', 'Baja la barra al pecho bajo con los codos a unos cuarenta y cinco grados.', 'Empuja hasta bloquear sobre los hombros.']),
 },
 'dumbbell_bench_press': {
  'en': (['flat dumbbell press'], 'Dumbbells travel in a slight arc', ['Lie on a flat bench with the dumbbells over the chest.', 'Lower until the elbows are just below the bench.', 'Press up and slightly together without clanking.']),
  'es': (['press plano con mancuernas'], 'Las mancuernas hacen un ligero arco', ['Túmbate en un banco plano con las mancuernas sobre el pecho.', 'Baja hasta que los codos queden justo por debajo del banco.', 'Empuja arriba y un poco hacia el centro sin chocarlas.']),
 },
 'incline_dumbbell_press': {
  'en': (['incline press', 'upper chest press'], 'Bench at thirty degrees, no higher', ['Set the bench to a low incline and sit with the dumbbells at the shoulders.', 'Lower under control until the upper arms are just below the bench.', 'Press up over the upper chest.']),
  'es': (['press inclinado con mancuernas', 'press de pecho superior'], 'Banco a treinta grados, no más', ['Pon el banco con una inclinación baja y siéntate con las mancuernas a los hombros.', 'Baja con control hasta que los brazos queden justo por debajo del banco.', 'Empuja arriba sobre el pecho alto.']),
 },
 'chest_press_machine': {
  'en': (['machine press', 'seated chest press'], 'Shoulder blades stay against the pad', ['Set the seat so the handles line up with the mid chest.', 'Press forward until the arms are almost straight.', 'Return slowly, keeping the shoulders back.']),
  'es': (['press de pecho en máquina', 'press sentado'], 'Las escápulas se quedan contra el respaldo', ['Ajusta el asiento para que las asas queden a la altura del pecho.', 'Empuja al frente hasta casi estirar los brazos.', 'Vuelve despacio con los hombros atrás.']),
 },
 'push_up': {
  'en': (['press-up'], 'Elbows at forty-five degrees, not flared', ['Hands slightly wider than the shoulders, body in one line.', 'Lower the chest to the floor keeping the hips level.', 'Press back up to full extension.']),
  'es': (['flexión', 'lagartija'], 'Codos a cuarenta y cinco grados, no abiertos', ['Manos un poco más anchas que los hombros, cuerpo en una línea.', 'Baja el pecho al suelo con la cadera nivelada.', 'Empuja hasta extender del todo.']),
 },
 'cable_fly': {
  'en': (['cable crossover'], 'Elbows soft and fixed', ['Stand between the pulleys with a handle in each hand and a slight lean forward.', 'Bring the hands together in front of the chest in a wide arc.', 'Open slowly until you feel the chest stretch.']),
  'es': (['cruce de poleas', 'aperturas en polea'], 'Codos suaves y fijos', ['Párate entre las poleas con un agarre en cada mano y una ligera inclinación al frente.', 'Junta las manos frente al pecho en un arco amplio.', 'Abre despacio hasta sentir el estiramiento del pecho.']),
 },
 'dumbbell_fly': {
  'en': (['chest fly'], 'Stop when the chest stretches, not when the shoulder hurts', ['Lie on a bench with the dumbbells above the chest, elbows slightly bent.', 'Open the arms in a wide arc until the chest is stretched.', 'Squeeze the chest to bring them back together.']),
  'es': (['aperturas con mancuernas'], 'Detente cuando el pecho se estire, no cuando duela el hombro', ['Túmbate en un banco con las mancuernas sobre el pecho y los codos un poco doblados.', 'Abre los brazos en arco hasta sentir el estiramiento.', 'Aprieta el pecho para juntarlas de nuevo.']),
 },
 'overhead_press': {
  'en': (['military press', 'standing press', 'OHP'], 'Push the head through at the top', ['Bar on the front of the shoulders, grip just outside the shoulders, glutes tight.', 'Press straight up, moving the head back slightly to clear the bar.', 'Lock out overhead, then lower to the shoulders.']),
  'es': (['press militar', 'press de hombro de pie'], 'Pasa la cabeza al frente en la parte alta', ['Barra al frente de los hombros, agarre justo por fuera, glúteos apretados.', 'Empuja recto arriba echando un poco la cabeza atrás para dejar pasar la barra.', 'Bloquea arriba y baja a los hombros.']),
 },
 'dumbbell_shoulder_press': {
  'en': (['seated dumbbell press'], 'Do not arch to press', ['Sit tall with the dumbbells at shoulder height, palms forward.', 'Press up until the arms are straight, not touching the dumbbells.', 'Lower under control to the shoulders.']),
  'es': (['press de hombro con mancuernas'], 'No arquees para empujar', ['Siéntate erguido con las mancuernas a la altura de los hombros y las palmas al frente.', 'Empuja arriba hasta estirar los brazos sin chocar las mancuernas.', 'Baja con control a los hombros.']),
 },
 'machine_shoulder_press': {
  'en': (['seated machine press'], 'Handles level with the shoulders', ['Set the seat so the handles start at shoulder height.', 'Press overhead until the arms are nearly straight.', 'Lower slowly to the start.']),
  'es': (['press de hombro en máquina'], 'Asas a la altura de los hombros', ['Ajusta el asiento para que las asas empiecen a la altura de los hombros.', 'Empuja arriba hasta casi estirar los brazos.', 'Baja despacio al inicio.']),
 },
 'pike_push_up': {
  'en': (['shoulder push-up'], 'Head travels forward of the hands', ['Start in a push-up position and walk the feet in until the hips are high.', 'Bend the elbows and lower the head toward the floor in front of the hands.', 'Press back up to the pike.']),
  'es': (['flexión pica', 'flexión de hombro'], 'La cabeza baja por delante de las manos', ['Empieza en posición de flexión y acerca los pies hasta elevar la cadera.', 'Dobla los codos y baja la cabeza al suelo por delante de las manos.', 'Empuja de vuelta a la posición en pica.']),
 },
 'lateral_raise': {
  'en': (['side raise', 'dumbbell lateral raise'], 'Lead with the elbows', ['Stand with a dumbbell in each hand at the sides.', 'Raise the arms out to shoulder height with a slight bend in the elbows.', 'Lower slowly, resisting the drop.']),
  'es': (['elevaciones laterales', 'vuelos laterales'], 'Guía el movimiento con los codos', ['De pie con una mancuerna en cada mano a los lados.', 'Eleva los brazos a los lados hasta la altura de los hombros con los codos un poco doblados.', 'Baja despacio resistiendo la caída.']),
 },
 'face_pull': {
  'en': (['rope face pull', 'rear delt pull'], 'Pull to the forehead, elbows high', ['Set a rope at face height and step back with the arms extended.', 'Pull toward the forehead, spreading the rope and pointing the elbows out.', 'Return slowly with control.']),
  'es': (['face pull con cuerda', 'tirón a la cara'], 'Tira hacia la frente con los codos altos', ['Pon una cuerda a la altura de la cara y aléjate con los brazos extendidos.', 'Tira hacia la frente abriendo la cuerda y con los codos hacia afuera.', 'Vuelve despacio con control.']),
 },
 'rear_delt_fly': {
  'en': (['reverse fly', 'bent-over fly'], 'Lead with the elbows, not the hands', ['Hinge forward with a dumbbell in each hand hanging below the chest.', 'Raise the arms out to the sides, elbows soft.', 'Lower slowly.']),
  'es': (['pájaros', 'aperturas invertidas'], 'Guía con los codos, no con las manos', ['Haz bisagra con una mancuerna en cada mano colgando bajo el pecho.', 'Eleva los brazos a los lados con los codos suaves.', 'Baja despacio.']),
 },
 'barbell_row': {
  'en': (['bent-over row'], 'Torso stays at the same angle for every rep', ['Hinge to about forty-five degrees with the bar hanging at the knees.', 'Pull the bar to the lower ribs, elbows driving back.', 'Lower under control without standing up.']),
  'es': (['remo con barra', 'remo inclinado'], 'El torso mantiene el mismo ángulo en todas las repeticiones', ['Haz bisagra a unos cuarenta y cinco grados con la barra colgando a las rodillas.', 'Tira de la barra hacia las costillas bajas con los codos hacia atrás.', 'Baja con control sin incorporarte.']),
 },
 'dumbbell_row': {
  'en': (['one-arm row', 'single-arm row'], 'Pull to the hip, not the shoulder', ['One hand and knee on a bench, the other foot on the floor, back flat.', 'Row the dumbbell to the hip, elbow close to the body.', 'Lower slowly until the arm is straight.']),
  'es': (['remo con mancuerna', 'remo a un brazo'], 'Tira hacia la cadera, no hacia el hombro', ['Una mano y una rodilla en el banco, el otro pie en el suelo, espalda plana.', 'Rema la mancuerna hacia la cadera con el codo pegado al cuerpo.', 'Baja despacio hasta estirar el brazo.']),
 },
 'chest_supported_row': {
  'en': (['incline dumbbell row', 'seal row'], 'Chest stays on the pad', ['Lie face down on an incline bench with the dumbbells hanging.', 'Row the dumbbells up, squeezing the shoulder blades together.', 'Lower slowly to a full stretch.']),
  'es': (['remo con apoyo en banco', 'remo en banco inclinado'], 'El pecho se queda en el banco', ['Boca abajo en un banco inclinado con las mancuernas colgando.', 'Rema las mancuernas juntando las escápulas.', 'Baja despacio hasta estirar del todo.']),
 },
 'seated_cable_row': {
  'en': (['cable row', 'low row'], 'Chest up, no rocking', ['Sit tall with the feet on the platform and the handle in both hands.', 'Pull the handle to the lower ribs, elbows close.', 'Return slowly until the arms are straight.']),
  'es': (['remo en polea baja', 'remo sentado'], 'Pecho arriba, sin balanceo', ['Siéntate erguido con los pies en la plataforma y el agarre en ambas manos.', 'Tira del agarre hacia las costillas bajas con los codos pegados.', 'Vuelve despacio hasta estirar los brazos.']),
 },
 'lat_pulldown': {
  'en': (['pulldown', 'cable pulldown'], 'Elbows drive down toward the hips', ['Sit with the thighs locked under the pad and a wide grip on the bar.', 'Pull the bar to the upper chest, leaning back slightly.', 'Let the bar rise slowly to a full stretch.']),
  'es': (['jalón al pecho', 'jalón dorsal'], 'Los codos bajan hacia la cadera', ['Siéntate con los muslos bajo la almohadilla y agarre amplio en la barra.', 'Tira de la barra hacia el pecho alto con una ligera inclinación atrás.', 'Deja subir la barra despacio hasta estirar del todo.']),
 },
 'pull_up': {
  'en': (['pull-ups', 'chin over bar'], 'Start every rep from a dead hang', ['Hang from the bar with the hands just wider than the shoulders.', 'Pull until the chin clears the bar, elbows driving down.', 'Lower slowly to straight arms.']),
  'es': (['dominadas', 'pull-ups'], 'Empieza cada repetición colgando del todo', ['Cuélgate de la barra con las manos un poco más anchas que los hombros.', 'Tira hasta que la barbilla pase la barra con los codos hacia abajo.', 'Baja despacio hasta estirar los brazos.']),
 },
 'inverted_row': {
  'en': (['bodyweight row', 'Australian pull-up'], 'Body in one line, squeeze the shoulder blades', ['Hang under a bar or table edge with the heels on the floor and the body straight.', 'Pull the chest to the bar, keeping the hips up.', 'Lower slowly to straight arms.']),
  'es': (['remo invertido', 'remo con peso corporal'], 'Cuerpo en una línea, junta las escápulas', ['Cuélgate bajo una barra o el borde de una mesa con los talones en el suelo y el cuerpo recto.', 'Tira del pecho hacia la barra con la cadera arriba.', 'Baja despacio hasta estirar los brazos.']),
 },
 'superman': {
  'en': (['prone extension'], 'Reach long, do not crank the neck', ['Lie face down with the arms extended overhead.', 'Lift the arms, chest and legs a few centimetres off the floor.', 'Hold briefly, then lower.']),
  'es': (['superman', 'extensión boca abajo'], 'Estírate en largo, no fuerces el cuello', ['Boca abajo con los brazos extendidos al frente.', 'Eleva brazos, pecho y piernas unos centímetros del suelo.', 'Mantén un momento y baja.']),
 },
 'dumbbell_curl': {
  'en': (['biceps curl', 'standing curl'], 'Elbows stay at the sides', ['Stand with a dumbbell in each hand, palms forward.', 'Curl the dumbbells to the shoulders without moving the elbows.', 'Lower slowly to full extension.']),
  'es': (['curl de bíceps', 'curl con mancuernas'], 'Los codos se quedan a los lados', ['De pie con una mancuerna en cada mano y las palmas al frente.', 'Sube las mancuernas hacia los hombros sin mover los codos.', 'Baja despacio hasta estirar del todo.']),
 },
 'hammer_curl': {
  'en': (['neutral-grip curl'], 'Thumbs up the whole rep', ['Stand with the dumbbells at the sides, palms facing in.', 'Curl to the shoulders keeping the palms facing each other.', 'Lower under control.']),
  'es': (['curl martillo'], 'Pulgares arriba toda la repetición', ['De pie con las mancuernas a los lados y las palmas enfrentadas.', 'Sube hacia los hombros manteniendo las palmas enfrentadas.', 'Baja con control.']),
 },
 'cable_curl': {
  'en': (['low pulley curl'], 'Constant tension, no rest at the bottom', ['Stand facing a low pulley with a bar or rope.', 'Curl to the shoulders, elbows fixed.', 'Lower slowly without letting the stack rest.']),
  'es': (['curl en polea baja'], 'Tensión constante, sin descansar abajo', ['De pie frente a la polea baja con una barra o cuerda.', 'Sube hacia los hombros con los codos fijos.', 'Baja despacio sin dejar que la carga descanse.']),
 },
 'barbell_curl': {
  'en': (['EZ-bar curl', 'standing barbell curl'], 'No hip swing', ['Stand with the bar at the thighs, hands shoulder width.', 'Curl the bar to the shoulders with the elbows fixed.', 'Lower slowly to straight arms.']),
  'es': (['curl con barra', 'curl con barra Z'], 'Sin impulso de cadera', ['De pie con la barra a los muslos y las manos al ancho de hombros.', 'Sube la barra a los hombros con los codos fijos.', 'Baja despacio hasta estirar los brazos.']),
 },
 'triceps_pushdown': {
  'en': (['cable pushdown', 'rope pushdown'], 'Elbows pinned at the sides', ['Stand at a high pulley with a rope or bar, elbows at the sides.', 'Push down until the arms are straight.', 'Return slowly until the forearms pass parallel.']),
  'es': (['extensión de tríceps en polea', 'jalón de tríceps'], 'Codos fijos a los lados', ['De pie en la polea alta con cuerda o barra, codos a los lados.', 'Empuja abajo hasta estirar los brazos.', 'Vuelve despacio hasta que los antebrazos pasen el paralelo.']),
 },
 'overhead_triceps_extension': {
  'en': (['French press', 'overhead extension'], 'Elbows point forward, not out', ['Hold one dumbbell overhead with both hands.', 'Lower it behind the head by bending the elbows.', 'Extend back to straight arms.']),
  'es': (['extensión de tríceps sobre la cabeza', 'press francés'], 'Los codos apuntan al frente, no hacia afuera', ['Sostén una mancuerna sobre la cabeza con ambas manos.', 'Bájala detrás de la cabeza doblando los codos.', 'Extiende hasta estirar los brazos.']),
 },
 'bench_dip': {
  'en': (['chair dip', 'triceps dip'], 'Shoulders down, away from the ears', ['Hands on the bench edge behind you, legs extended in front.', 'Lower until the elbows reach ninety degrees.', 'Press back up to straight arms.']),
  'es': (['fondos en banco', 'fondos en silla'], 'Hombros abajo, lejos de las orejas', ['Manos en el borde del banco detrás de ti, piernas extendidas al frente.', 'Baja hasta que los codos lleguen a noventa grados.', 'Empuja hasta estirar los brazos.']),
 },
 'skull_crusher': {
  'en': (['lying triceps extension'], 'Elbows stay in the same place', ['Lie on a bench holding the bar over the chest.', 'Bend the elbows to lower the bar toward the forehead.', 'Extend the elbows to press it back up.']),
  'es': (['rompecráneos', 'extensión de tríceps tumbado'], 'Los codos se quedan en el mismo sitio', ['Túmbate en un banco con la barra sobre el pecho.', 'Dobla los codos para bajar la barra hacia la frente.', 'Extiende los codos para volver a subir.']),
 },
 'plank': {
  'en': (['front plank', 'forearm plank'], 'Tuck the pelvis and squeeze the glutes', ['Forearms on the floor, elbows under the shoulders, feet together.', 'Lift the body into one line from head to heels.', 'Hold, breathing steadily.']),
  'es': (['plancha frontal', 'plancha de antebrazos'], 'Mete la pelvis y aprieta los glúteos', ['Antebrazos en el suelo, codos bajo los hombros, pies juntos.', 'Eleva el cuerpo formando una línea de la cabeza a los talones.', 'Mantén respirando con calma.']),
 },
 'side_plank': {
  'en': (['lateral plank'], 'Stack the feet and push the hip up', ['Lie on your side with the elbow under the shoulder.', 'Lift the hips until the body is one line.', 'Hold, then switch sides.']),
  'es': (['plancha lateral'], 'Pies uno sobre otro y cadera arriba', ['De lado con el codo bajo el hombro.', 'Eleva la cadera hasta que el cuerpo sea una línea.', 'Mantén y cambia de lado.']),
 },
 'dead_bug': {
  'en': (['deadbug'], 'Exhale as the limbs extend', ['Lie on your back with the arms up and the knees over the hips.', 'Extend one arm overhead and the opposite leg out, lower back pressed down.', 'Return and switch sides.']),
  'es': (['bicho muerto', 'dead bug'], 'Exhala mientras extiendes', ['Boca arriba con los brazos arriba y las rodillas sobre la cadera.', 'Extiende un brazo atrás y la pierna contraria al frente con la lumbar pegada al suelo.', 'Vuelve y cambia de lado.']),
 },
 'hanging_knee_raise': {
  'en': (['knee raise', 'hanging knee tuck'], 'Curl the pelvis at the top', ['Hang from a bar with a firm grip.', 'Raise the knees toward the chest, curling the pelvis up.', 'Lower slowly without swinging.']),
  'es': (['elevación de rodillas colgado'], 'Curva la pelvis arriba', ['Cuélgate de una barra con agarre firme.', 'Sube las rodillas hacia el pecho curvando la pelvis.', 'Baja despacio sin balancearte.']),
 },
 'cable_crunch': {
  'en': (['kneeling crunch', 'rope crunch'], 'Round the spine, hips still', ['Kneel facing a high pulley with the rope at the sides of the head.', 'Crunch down, bringing the elbows toward the knees.', 'Return slowly, keeping the hips still.']),
  'es': (['crunch en polea', 'crunch de rodillas'], 'Redondea la columna con la cadera quieta', ['De rodillas frente a la polea alta con la cuerda a los lados de la cabeza.', 'Flexiona el tronco llevando los codos hacia las rodillas.', 'Vuelve despacio con la cadera quieta.']),
 },
 'pallof_press': {
  'en': (['anti-rotation press'], 'Resist the pull, hips square', ['Stand side-on to a cable at chest height, handle at the sternum.', 'Press the handle straight out and hold.', 'Return to the chest and repeat, then switch sides.']),
  'es': (['press Pallof', 'press antirrotación'], 'Resiste el tirón con la cadera al frente', ['De lado a una polea a la altura del pecho, con el agarre en el esternón.', 'Empuja el agarre recto al frente y mantén.', 'Vuelve al pecho, repite y cambia de lado.']),
 },
 'bicycle_crunch': {
  'en': (['bicycle'], 'Slow, shoulder to knee', ['Lie on your back with the hands behind the head and the legs raised.', 'Bring one elbow toward the opposite knee while extending the other leg.', 'Alternate sides in a slow, controlled rhythm.']),
  'es': (['bicicleta', 'crunch bicicleta'], 'Lento, hombro hacia la rodilla', ['Boca arriba con las manos detrás de la cabeza y las piernas elevadas.', 'Lleva un codo hacia la rodilla contraria mientras extiendes la otra pierna.', 'Alterna los lados a un ritmo lento y controlado.']),
 },
 'burpee': {
  'en': (['burpees'], 'Land soft, chest up', ['From standing, squat down and place the hands on the floor.', 'Jump the feet back, do a push-up, then jump the feet in.', 'Stand and jump, reaching overhead.']),
  'es': (['burpees'], 'Aterriza suave con el pecho arriba', ['De pie, baja en sentadilla y apoya las manos en el suelo.', 'Lleva los pies atrás de un salto, haz una flexión y vuelve a traerlos.', 'Ponte de pie y salta estirando los brazos arriba.']),
 },
 'jump_squat': {
  'en': (['squat jump'], 'Reset the stance every landing', ['Squat to about parallel with the arms back.', 'Jump as high as you can, reaching up.', 'Land softly into the next squat.']),
  'es': (['sentadilla con salto'], 'Reajusta la postura en cada aterrizaje', ['Baja a sentadilla hasta el paralelo con los brazos atrás.', 'Salta lo más alto que puedas estirando los brazos arriba.', 'Aterriza suave en la siguiente sentadilla.']),
 },
 'mountain_climber': {
  'en': (['climbers'], 'Hips stay level', ['Start in a push-up position with the hands under the shoulders.', 'Drive one knee toward the chest, then switch quickly.', 'Keep the hips low and the pace steady.']),
  'es': (['escaladores'], 'La cadera se queda nivelada', ['Empieza en posición de flexión con las manos bajo los hombros.', 'Lleva una rodilla al pecho y cambia rápido.', 'Mantén la cadera baja y el ritmo constante.']),
 },
 'jumping_jack': {
  'en': (['star jumps'], 'Soft knees on every landing', ['Stand with the feet together and arms at the sides.', 'Jump the feet apart while raising the arms overhead.', 'Jump back to the start and repeat at a steady pace.']),
  'es': (['saltos de tijera', 'polichinelas'], 'Rodillas suaves en cada aterrizaje', ['De pie con los pies juntos y los brazos a los lados.', 'Salta abriendo los pies mientras subes los brazos.', 'Vuelve al inicio de un salto y repite a ritmo constante.']),
 },
 'farmers_carry': {
  'en': (["farmer's walk", 'loaded carry'], 'Grip hard, walk tall', ['Pick up a heavy dumbbell in each hand.', 'Walk the distance with the shoulders back and the trunk braced.', 'Set them down under control and rest.']),
  'es': (['paseo del granjero', 'caminata con peso'], 'Agarra fuerte y camina erguido', ['Levanta una mancuerna pesada en cada mano.', 'Camina la distancia con los hombros atrás y el tronco firme.', 'Déjalas en el suelo con control y descansa.']),
 },
 'dumbbell_swing': {
  'en': (['one-dumbbell swing'], 'Snap the hips, the arms are ropes', ['Hold one dumbbell with both hands, feet shoulder width.', 'Hinge and swing it between the legs, then snap the hips forward.', 'Let it float to chest height and swing it back down.']),
  'es': (['swing con mancuerna'], 'Extiende la cadera con fuerza, los brazos son cuerdas', ['Sostén una mancuerna con ambas manos, pies al ancho de hombros.', 'Haz bisagra y llévala entre las piernas, luego extiende la cadera con fuerza.', 'Deja que suba hasta el pecho y vuelve a bajarla.']),
 },
 'bike_intervals': {
  'en': (['bike sprints', 'spin intervals'], 'Sit tall and spin, do not mash', ['Warm up five minutes easy.', 'Push hard for the interval, then spin easy to recover.', 'Repeat the rounds and cool down easy.']),
  'es': (['series en bici', 'sprints en bicicleta'], 'Siéntate erguido y pedalea, no aplastes', ['Calienta cinco minutos suave.', 'Empuja fuerte durante el intervalo y pedalea suave para recuperar.', 'Repite las rondas y enfría suave.']),
 },
 'rower_intervals': {
  'en': (['rowing intervals', 'erg intervals'], 'Legs, then body, then arms', ['Warm up five minutes easy.', 'Row hard for the interval driving with the legs first.', 'Recover easy between rounds and cool down.']),
  'es': (['series en remo', 'remo ergómetro'], 'Piernas, luego tronco, luego brazos', ['Calienta cinco minutos suave.', 'Rema fuerte durante el intervalo empujando primero con las piernas.', 'Recupera suave entre rondas y enfría.']),
 },
 'box_jump': {
  'en': (['jump to box'], 'Step down, never jump down', ['Stand an arm\'s length from a box you can land on with soft knees.', 'Swing the arms and jump, landing quietly with the whole foot.', 'Stand tall, then step down.']),
  'es': (['salto al cajón'], 'Baja caminando, nunca de un salto', ['Párate a un brazo de distancia de un cajón donde aterrices con las rodillas suaves.', 'Balancea los brazos y salta aterrizando en silencio con todo el pie.', 'Ponte de pie y baja caminando.']),
 },
 'broad_jump': {
  'en': (['standing long jump'], 'Stick the landing before the next rep', ['Stand with the feet hip width and the arms back.', 'Swing the arms and jump forward as far as you can.', 'Land softly in a quarter squat and hold.']),
  'es': (['salto horizontal', 'salto de longitud sin carrera'], 'Clava el aterrizaje antes de la siguiente', ['De pie con los pies al ancho de cadera y los brazos atrás.', 'Balancea los brazos y salta al frente lo más lejos posible.', 'Aterriza suave en un cuarto de sentadilla y mantén.']),
 },
 'push_press': {
  'en': (['barbell push press'], 'Short dip, then explode', ['Bar on the front of the shoulders, feet hip width.', 'Dip a few centimetres with the knees, then drive up fast.', 'Press to lockout overhead and lower to the shoulders.']),
  'es': (['push press con barra', 'press de empuje'], 'Flexión corta y explota', ['Barra al frente de los hombros, pies al ancho de cadera.', 'Baja unos centímetros con las rodillas y sube rápido.', 'Empuja hasta bloquear arriba y baja a los hombros.']),
 },
 'dumbbell_push_press': {
  'en': (['dumbbell jerk'], 'Legs start it, arms finish it', ['Dumbbells at the shoulders, feet hip width.', 'Dip slightly, then drive the legs and press overhead.', 'Lower under control to the shoulders.']),
  'es': (['push press con mancuernas'], 'Las piernas lo inician, los brazos lo terminan', ['Mancuernas a los hombros, pies al ancho de cadera.', 'Flexiona un poco las rodillas y empuja con las piernas hasta arriba.', 'Baja con control a los hombros.']),
 },
 'kettlebell_swing': {
  'en': (['Russian swing', 'KB swing'], 'The bell floats, you do not lift it', ['Kettlebell on the floor in front, hinge and grip it with both hands.', 'Hike it back between the legs and snap the hips forward.', 'Let it float to chest height and guide it back into the next hinge.']),
  'es': (['swing con kettlebell', 'swing ruso'], 'La pesa flota, tú no la levantas', ['Kettlebell en el suelo al frente; haz bisagra y agárrala con ambas manos.', 'Lánzala atrás entre las piernas y extiende la cadera con fuerza.', 'Deja que flote hasta el pecho y guíala a la siguiente bisagra.']),
 },
 'medicine_ball_slam': {
  'en': (['ball slam'], 'Full extension overhead, then slam', ['Hold the ball overhead with the feet shoulder width.', 'Slam it into the floor as hard as you can, folding at the hips.', 'Catch it on the bounce or pick it up and reset.']),
  'es': (['lanzamiento de balón medicinal', 'slam con balón'], 'Extiende del todo arriba y lanza', ['Sostén el balón sobre la cabeza con los pies al ancho de hombros.', 'Lánzalo al suelo con toda la fuerza doblando la cadera.', 'Atrápalo en el rebote o recógelo y vuelve a empezar.']),
 },
 'hip_flexor_stretch': {
  'en': (['kneeling hip flexor stretch', 'couch stretch'], 'Tuck the pelvis before leaning', ['Kneel on one knee with the other foot in front.', 'Squeeze the glute of the back leg and tuck the pelvis under.', 'Shift forward gently until the front of the hip stretches; hold and breathe.']),
  'es': (['estiramiento de psoas', 'estiramiento de flexores de cadera'], 'Mete la pelvis antes de inclinarte', ['Arrodíllate sobre una rodilla con el otro pie al frente.', 'Aprieta el glúteo de la pierna de atrás y mete la pelvis.', 'Avanza suave hasta sentir el estiramiento en el frente de la cadera; mantén y respira.']),
 },
 'worlds_greatest_stretch': {
  'en': (['spiderman with rotation', 'lunge and reach'], 'Reach to the ceiling, follow the hand with your eyes', ['Step into a long lunge and put both hands inside the front foot.', 'Drop the inside elbow toward the floor, then rotate and reach that arm to the ceiling.', 'Return and switch sides.']),
  'es': (['el mejor estiramiento del mundo', 'zancada con rotación'], 'Estira hacia el techo y sigue la mano con la mirada', ['Da una zancada larga y apoya ambas manos por dentro del pie delantero.', 'Baja el codo interior hacia el suelo, luego rota y estira ese brazo al techo.', 'Vuelve y cambia de lado.']),
 },
 'ninety_ninety_hip': {
  'en': (['90/90 hip stretch', 'shin box'], 'Sit tall; rotate from the hips', ['Sit with the front leg bent ninety degrees in front and the back leg ninety degrees to the side.', 'Sit tall and lean the chest over the front shin.', 'Hold, then switch the legs to the other side.']),
  'es': (['estiramiento 90/90', 'noventa-noventa de cadera'], 'Siéntate erguido y rota desde la cadera', ['Siéntate con la pierna delantera doblada a noventa grados al frente y la trasera a noventa grados al lado.', 'Siéntate erguido e inclina el pecho sobre la espinilla delantera.', 'Mantén y cambia las piernas al otro lado.']),
 },
 'thoracic_rotation': {
  'en': (['open book', 'quadruped rotation'], 'Hips stay square; only the upper back turns', ['On all fours, place one hand behind the head.', 'Rotate the elbow toward the opposite wrist, then up to the ceiling.', 'Repeat slowly, then switch sides.']),
  'es': (['rotación torácica', 'libro abierto'], 'La cadera se queda al frente; solo gira la espalda alta', ['A cuatro patas, pon una mano detrás de la cabeza.', 'Rota el codo hacia la muñeca contraria y luego hacia el techo.', 'Repite despacio y cambia de lado.']),
 },
 'cat_cow': {
  'en': (['cat-camel'], 'Move one vertebra at a time', ['On all fours with the hands under the shoulders and knees under the hips.', 'Exhale and round the back toward the ceiling, tucking the chin.', 'Inhale and arch, lifting the chest and tailbone.']),
  'es': (['gato-vaca', 'gato-camello'], 'Mueve una vértebra a la vez', ['A cuatro patas con las manos bajo los hombros y las rodillas bajo la cadera.', 'Exhala y redondea la espalda hacia el techo metiendo la barbilla.', 'Inhala y arquea levantando el pecho y el coxis.']),
 },
 'shoulder_dislocate': {
  'en': (['band pass-through', 'shoulder pass-through'], 'Widen the grip until it passes without bending the elbows', ['Hold a band or stick with a wide grip in front of the hips.', 'Raise it overhead and behind you with straight arms.', 'Bring it back over the top the same way.']),
  'es': (['pasadas de hombro con banda', 'dislocaciones de hombro'], 'Abre el agarre hasta que pase sin doblar los codos', ['Sostén una banda o palo con agarre ancho frente a la cadera.', 'Súbelo por encima de la cabeza y hacia atrás con los brazos rectos.', 'Tráelo de vuelta por arriba del mismo modo.']),
 },
 'wall_slide': {
  'en': (['wall angels'], 'Forearms stay on the wall', ['Stand with the back, elbows and wrists against a wall.', 'Slide the arms up overhead keeping contact with the wall.', 'Slide back down, pulling the elbows toward the ribs.']),
  'es': (['deslizamiento en pared', 'ángeles en la pared'], 'Los antebrazos se quedan en la pared', ['De pie con la espalda, los codos y las muñecas contra la pared.', 'Desliza los brazos arriba manteniendo el contacto con la pared.', 'Vuelve a bajar llevando los codos hacia las costillas.']),
 },
 'calf_stretch': {
  'en': (['wall calf stretch'], 'Straight knee for the calf, bent knee for the lower leg', ['Face a wall with one foot back, heel on the floor.', 'Lean in until the back calf stretches, keeping the heel down.', 'Hold, then repeat with the back knee slightly bent.']),
  'es': (['estiramiento de gemelos', 'estiramiento de pantorrilla en pared'], 'Rodilla recta para el gemelo, doblada para el sóleo', ['Frente a una pared con un pie atrás y el talón en el suelo.', 'Inclínate hasta sentir el estiramiento en la pantorrilla trasera con el talón abajo.', 'Mantén y repite con la rodilla trasera un poco doblada.']),
 },
 'deep_squat_hold': {
  'en': (['squat hold', 'third-world squat'], 'Use the elbows to push the knees out', ['Sink into a full squat, heels down, holding something if needed.', 'Push the knees out with the elbows and lift the chest.', 'Breathe and hold, shifting side to side if it helps.']),
  'es': (['sentadilla profunda mantenida', 'sentadilla de descanso'], 'Usa los codos para abrir las rodillas', ['Baja a sentadilla completa con los talones abajo, sujetándote si hace falta.', 'Abre las rodillas con los codos y levanta el pecho.', 'Respira y mantén, moviéndote de lado a lado si ayuda.']),
 },
 'glute_bridge_hold': {
  'en': (['bridge hold', 'isometric bridge'], 'Keep breathing; the glutes do the work', ['Lie on your back with the knees bent and feet flat.', 'Drive the hips up until the body is a straight line.', 'Hold at the top, squeezing the glutes, then lower.']),
  'es': (['puente de glúteo isométrico', 'puente mantenido'], 'Sigue respirando; el trabajo lo hacen los glúteos', ['Boca arriba con las rodillas dobladas y los pies planos.', 'Empuja la cadera arriba hasta formar una línea recta.', 'Mantén arriba apretando los glúteos y baja.']),
 },
}

ORDER = ['name', 'aliases', 'cue1', 'cue2', 'cue3', 'mistake1', 'mistake2', 'step1', 'step2', 'step3']
for locale in ('en', 'es'):
    path = pathlib.Path(f'messages/{locale}.json')
    data = json.loads(path.read_text())
    ex = data['exercises']
    for ident, both in X.items():
        aliases, cue3, steps = both[locale]
        old = ex[ident]
        old.update({'aliases': ', '.join(aliases), 'cue3': cue3, 'step1': steps[0], 'step2': steps[1], 'step3': steps[2]})
        ex[ident] = {k: old[k] for k in ORDER}
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print('extended', len(X), 'exercises')
