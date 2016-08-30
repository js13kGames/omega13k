/**
 * Level Definition
 */
$.assign($, {
	levelCurrent : 0,
	levelStepCurrent: 0,

	levelSpec: () => {
		return [
			[
				[$.SplashLevel]
			],
			[
				[$.DialogLevel, 0],
				[$.DialogLevel, 1],
				[$.WaveLevel, 3],
				[$.DialogLevel, 2],
				[$.WaveLevel, 10000]
			],
			/*
			[
				[$.DialogLevel, 3],
				[$.WaveLevel, 12],
				[$.BossLevel, 1]
			]
			*/
		];
	},

	/**
	 * Go to the next level
	 */
	levelNext: () => {
		let spec = $.levelSpec(),
			currSpec;

		$.levelStepCurrent++;

		if ($.levelStepCurrent >= spec[$.levelCurrent].length) {
			$.levelCurrent++;
			$.levelStepCurrent = 0;
		}

		currSpec = spec[$.levelCurrent][$.levelStepCurrent];
		currSpec[0][LevelSpecConst.ON_ENTER].apply(null, currSpec.slice(1));
	}
})

// Enter the first level on load
$.levelSpec()[0][0][0][LevelSpecConst.ON_ENTER]();
