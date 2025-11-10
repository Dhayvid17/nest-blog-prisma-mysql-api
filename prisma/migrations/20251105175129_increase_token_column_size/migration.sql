-- DropIndex
DROP INDEX `RefreshTokens_token_idx` ON `refreshtokens`;

-- AlterTable
ALTER TABLE `refreshtokens` MODIFY `token` TEXT NOT NULL,
    MODIFY `deviceInfo` VARCHAR(191) NULL DEFAULT 'Unknown Device';

-- CreateIndex
CREATE INDEX `RefreshTokens_token_idx` ON `RefreshTokens`(`token`(255));
