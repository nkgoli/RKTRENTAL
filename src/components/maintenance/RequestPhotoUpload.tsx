'use client';
import styles from './maintenance.module.css';

/** Submit the existing photo action as soon as a photo is chosen. */
export function RequestPhotoUpload() {
  return (
    <label className={styles.addPhoto}>
      <span aria-hidden="true">＋</span>
      <span>Add photo</span>
      <input
        type="file"
        name="photo"
        accept=".jpg,.jpeg,.png,.heic,.heif"
        aria-label="Add photo"
        required
        onChange={(event) => {
          if (event.target.files?.length) event.currentTarget.form?.requestSubmit();
        }}
      />
    </label>
  );
}
