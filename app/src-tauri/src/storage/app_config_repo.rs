use crate::domain::workspace::AppConfig;
use platform_dirs::AppDirs;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppConfigRepoError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
}

pub struct AppConfigRepo;

impl AppConfigRepo {
    pub fn config_path() -> PathBuf {
        let dirs = AppDirs::new(Some("Ponder"), false).expect("failed to resolve app dirs");
        dirs.config_dir.join("config.json")
    }

    pub fn load(&self) -> Result<AppConfig, AppConfigRepoError> {
        let path = Self::config_path();
        let contents = match fs::read_to_string(&path) {
            Ok(s) => s,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(AppConfig::default()),
            Err(e) => return Err(e.into()),
        };

        if contents.trim().is_empty() {
            return Ok(AppConfig::default());
        }

        Ok(serde_json::from_str(&contents)?)
    }

    pub fn save(&self, cfg: &AppConfig) -> Result<(), AppConfigRepoError> {
        let path = Self::config_path();
        let mut bytes = serde_json::to_vec_pretty(cfg)?;
        bytes.push(b'\n');
        atomic_write(&path, &bytes)?;
        Ok(())
    }
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), std::io::Error> {
    let dir = path
        .parent()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::Other, "missing parent dir"))?;
    fs::create_dir_all(dir)?;

    let file_name = path
        .file_name()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::Other, "missing file name"))?;
    let tmp_path = dir.join(format!(".{}.tmp", file_name.to_string_lossy()));

    {
        let mut file = fs::File::create(&tmp_path)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }

    fs::rename(tmp_path, path)?;
    Ok(())
}
