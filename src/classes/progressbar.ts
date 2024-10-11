export function progressBar(ratio: number, length = 6) {
	const progress = Math.min(Math.max(Math.floor(ratio * length), 0), length);

	if (progress === length) return '🟨'.repeat(progress);

	return '🟩'.repeat(progress) + '⬛'.repeat(length - progress);
}
