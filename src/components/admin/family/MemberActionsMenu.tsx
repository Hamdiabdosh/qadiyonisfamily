import { Image, Link2, MoreHorizontal, Skull, Trash2, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Member } from "@/lib/family";
import { copyMemberInviteLink } from "./member-actions";

type Props = {
  member: Member;
  onPhoto: (member: Member) => void;
  onSetAlive: (id: number, isAlive: boolean) => void;
  onDelete: (member: Member) => void;
  triggerClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
};

export function MemberActionsMenu({
  member,
  onPhoto,
  onSetAlive,
  onDelete,
  triggerClassName,
  onClick,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={triggerClassName ?? "h-8 w-8 p-0"}
          onClick={onClick}
        >
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Actions for {member.full_name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onPhoto(member)}>
          <Image className="size-4 mr-2" />
          Upload photo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyMemberInviteLink(member.id)}>
          <Link2 className="size-4 mr-2" />
          Copy invite link
        </DropdownMenuItem>
        {!member.is_root && (
          <DropdownMenuItem onClick={() => onSetAlive(member.id, !member.is_alive)}>
            {member.is_alive ? (
              <>
                <Skull className="size-4 mr-2" />
                Mark as deceased
              </>
            ) : (
              <>
                <UserCheck className="size-4 mr-2" />
                Mark as alive
              </>
            )}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(member)}>
          <Trash2 className="size-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
